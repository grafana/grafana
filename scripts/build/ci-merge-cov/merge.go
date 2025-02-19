// This file is mostly based on this nice BSD-2 licensed source: https://github.com/wadey/gocovmerge/blob/master/gocovmerge.go
// The following is the licence of said source code by Wade Simmons. Do not remove it, as the licence requires us to note it:
//
// Copyright (c) 2015, Wade Simmons
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//
// 1. Redistributions of source code must retain the above copyright notice, this
//    list of conditions and the following disclaimer.
// 2. Redistributions in binary form must reproduce the above copyright notice,
//    this list of conditions and the following disclaimer in the documentation
//    and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
// ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//
// Further, we have added some glue, which is owned and copyrighted by Grafana Labs under this repository's licence (grafana/grafana).

package main

import (
	"fmt"
	"log/slog"
	"os"
	"slices"
	"sort"

	"golang.org/x/tools/cover"
)

func main() {
	slog.SetDefault(slog.New(
		slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
			Level: slog.LevelInfo,
		}),
	))

	if err := run(os.Args); err != nil {
		slog.Error("app failed", "error", err)
		os.Exit(1)
	}
}

func run(osArgs []string) error {
	if len(osArgs) < 4 {
		return fmt.Errorf("usage: %s <output merge> <2+ profiles to merge>", osArgs[0])
	}
	outputFpath := osArgs[1]
	toMerge := osArgs[2:]

	var merged []*cover.Profile
	for _, fpath := range toMerge {
		profiles, err := cover.ParseProfiles(fpath)
		if err != nil {
			return fmt.Errorf("failed to parse profiles in '%s': %w", fpath, err)
		}
		if len(profiles) == 0 {
			slog.Warn("no profiles present in file", "file", fpath)
			continue
		}
		for _, profile := range profiles {
			merged, err = merge(merged, profile)
			if err != nil {
				return fmt.Errorf("failed to merge individual profiles from '%s': %w", fpath, err)
			}
		}
		slog.Info("merged profiles from a file", "fpath", fpath)
	}

	if len(merged) == 0 {
		return fmt.Errorf("no profiles were present in the given files")
	}

	// From profile.go:
	// First line is "mode: foo", where foo is "set", "count", or "atomic".
	// Rest of file is in the format
	//	encoding/base64/base64.go:34.44,37.40 3 1
	// where the fields are: name.go:line.column,line.column numberOfStatements count
	writer, err := os.Create(outputFpath)
	if err != nil {
		return fmt.Errorf("could not create file '%s': %w", outputFpath, err)
	}

	_, err = writer.WriteString(fmt.Sprintf("mode: %s\n", merged[0].Mode))
	if err != nil {
		return fmt.Errorf("failed to write to file '%s': %w", outputFpath, err)
	}
	for _, profile := range merged {
		for _, block := range profile.Blocks {
			_, err = writer.WriteString(fmt.Sprintf("%s:%d.%d,%d.%d %d %d\n",
				profile.FileName,
				block.StartLine, block.StartCol,
				block.EndLine, block.EndCol,
				block.NumStmt,
				block.Count))
			if err != nil {
				return fmt.Errorf("failed to write to file '%s': %w", outputFpath, err)
			}
		}
	}

	if err := writer.Close(); err != nil {
		// We want to ensure we flush at the end, which we do by closing.
		return fmt.Errorf("failed to close file '%s': %w", outputFpath, err)
	}
	slog.Info("Written final output", "fpath", outputFpath)
	return nil
}

func merge(dst []*cover.Profile, src *cover.Profile) ([]*cover.Profile, error) {
	idx := sort.Search(len(dst), func(i int) bool { return dst[i].FileName >= src.FileName })
	if idx < len(dst) && // We might get a hint to put the element at the end
		dst[idx].FileName == src.FileName { // We don't want to merge two profiles that aren't of the same code!
		if err := mergeSingle(dst[idx], src); err != nil {
			return nil, err
		}
	} else { // src is not in dst already. Let's add it where it's supposed to be.
		dst = slices.Insert(dst, idx, src)
	}
	return dst, nil
}

func mergeSingle(dst, src *cover.Profile) error {
	if dst.Mode != src.Mode {
		return fmt.Errorf("two profiles of different modes were provided (%s vs %s)", dst.Mode, src.Mode)
	}

	// Since the blocks are sorted, we can keep track of where the last block
	// was inserted and only look at the blocks after that as targets for merge
	var err error
	idx := 0
	for _, block := range src.Blocks {
		idx, err = mergeBlock(dst, block, idx)
		if err != nil {
			return err
		}
	}

	return nil
}

// mergeBlock merges the block into dst and returns the new index of what block to work on in the dst block for the next src block to merge in.
// The NumStmt does not change: we are not adding any statements. However, the Count does: we are calling the code more often, as there are multiple test suites to take into account.
func mergeBlock(dst *cover.Profile, block cover.ProfileBlock, initIdx int) (int, error) {
	sortFunc := func(i int) bool {
		pi := dst.Blocks[i+initIdx]
		return pi.StartLine >= block.StartLine && (pi.StartLine != block.StartLine || pi.StartCol >= block.StartCol)
	}

	idx := 0
	if !sortFunc(idx) {
		idx = sort.Search(len(dst.Blocks)-initIdx, sortFunc)
	}
	idx += initIdx
	if idx < len(dst.Blocks) && // We might have a hint to put the block at the end
		dst.Blocks[idx].StartLine == block.StartLine && dst.Blocks[idx].StartCol == block.StartCol { // Ensure we're dealing with the same block of code
		if dst.Blocks[idx].EndLine != block.EndLine || dst.Blocks[idx].EndCol != block.EndCol {
			return 0, fmt.Errorf("block has mismatched location (file %s %d.%d vs %d.%d)",
				dst.FileName,
				block.StartLine, block.StartCol,
				block.EndLine, block.EndCol,
			)
		}

		switch dst.Mode {
		case "set":
			dst.Blocks[idx].Count |= block.Count
		case "count", "atomic":
			dst.Blocks[idx].Count += block.Count
		default:
			return 0, fmt.Errorf("unsupported cover mode encountered: %s", dst.Mode)
		}
	} else {
		if idx > 0 {
			pa := dst.Blocks[idx-1]
			if pa.EndLine >= block.EndLine && (pa.EndLine != block.EndLine || pa.EndCol > block.EndCol) {
				return 0, fmt.Errorf("block has mismatched location (file %s %v vs %v)", dst.FileName, pa, block)
			}
		}

		if idx < len(dst.Blocks)-1 {
			pa := dst.Blocks[idx+1]
			if pa.StartLine <= block.StartLine && (pa.StartLine != block.StartLine || pa.StartCol < block.StartCol) {
				return 0, fmt.Errorf("block has mismatched location (file %s %v vs %v)", dst.FileName, pa, block)
			}
		}

		dst.Blocks = append(dst.Blocks, cover.ProfileBlock{})
		copy(dst.Blocks[idx+1:], dst.Blocks[idx:])
		dst.Blocks[idx] = block
	}
	return idx + 1, nil
}
