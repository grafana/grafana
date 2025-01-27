// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

package parquet

import (
	"bufio"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"os"
	"strconv"
	"strings"

	"github.com/apache/arrow-go/v18/parquet"
	"github.com/apache/arrow-go/v18/parquet/file"
	"github.com/apache/arrow-go/v18/parquet/metadata"
	"github.com/apache/arrow-go/v18/parquet/schema"
)

var version = ""
var usage = `Parquet Reader (version ` + version + `)
Usage:
  parquet_reader -h | --help
  parquet_reader [--only-metadata] [--no-metadata] [--no-memory-map] [--json] [--csv] [--output=FILE]
                 [--print-key-value-metadata] [--int96-timestamp] [--columns=COLUMNS] <file>
Options:
  -h --help                     Show this screen.
  --print-key-value-metadata    Print out the key-value metadata. [default: false]
  --only-metadata               Stop after printing metadata, no values.
  --no-metadata                 Do not print metadata.
  --output=FILE                 Specify output file for data. [default: -]
  --no-memory-map               Disable memory mapping the file.
  --int96-timestamp             Parse INT96 as TIMESTAMP for legacy support.
  --json                        Format output as JSON instead of text.
  --csv                         Format output as CSV instead of text.
  --columns=COLUMNS             Specify a subset of columns to print, comma delimited indexes.`

func main() {
	var config struct {
		PrintKeyValueMetadata bool
		OnlyMetadata          bool
		NoMetadata            bool
		Output                string
		NoMemoryMap           bool
		JSON                  bool `docopt:"--json"`
		CSV                   bool `docopt:"--csv"`
		ParseInt96AsTimestamp bool `docopt:"--int96-timestamp"`
		Columns               string
		File                  string
	}

	parseInt96AsTimestamp = config.ParseInt96AsTimestamp

	var dataOut io.Writer
	dataOut = os.Stdout
	if config.Output != "-" {
		var err error
		fileOut, err := os.Create(config.Output)
		if err != nil {
			fmt.Fprintf(os.Stderr, "error: --output %q cannot be created, %s\n", config.Output, err)
			os.Exit(1)
		}
		bufOut := bufio.NewWriter(fileOut)
		defer func() {
			bufOut.Flush()
			fileOut.Close()
		}()
		dataOut = bufOut
	}

	if config.CSV && config.JSON {
		fmt.Fprintln(os.Stderr, "error: both --json and --csv outputs selected.")
		os.Exit(1)
	}

	selectedColumns := []int{}
	if config.Columns != "" {
		for _, c := range strings.Split(config.Columns, ",") {
			cval, err := strconv.Atoi(c)
			if err != nil {
				fmt.Fprintln(os.Stderr, "error: --columns needs to be comma-delimited integers")
				os.Exit(1)
			}
			selectedColumns = append(selectedColumns, cval)
		}
	}

	rdr, err := file.OpenParquetFile(config.File, !config.NoMemoryMap)
	if err != nil {
		fmt.Fprintln(os.Stderr, "error opening parquet file: ", err)
		os.Exit(1)
	}

	fileMetadata := rdr.MetaData()

	if !config.NoMetadata {
		fmt.Println("File name:", config.File)
		fmt.Println("Version:", fileMetadata.Version())
		fmt.Println("Created By:", fileMetadata.GetCreatedBy())
		fmt.Println("Num Rows:", rdr.NumRows())

		keyvaluemeta := fileMetadata.KeyValueMetadata()
		if config.PrintKeyValueMetadata && keyvaluemeta != nil {
			fmt.Println("Key Value File Metadata:", keyvaluemeta.Len(), "entries")
			keys := keyvaluemeta.Keys()
			values := keyvaluemeta.Values()
			for i := 0; i < keyvaluemeta.Len(); i++ {
				fmt.Printf("Key nr %d %s: %s\n", i, keys[i], values[i])
			}
		}

		fmt.Println("Number of RowGroups:", rdr.NumRowGroups())
		fmt.Println("Number of Real Columns:", fileMetadata.Schema.Root().NumFields())
		fmt.Println("Number of Columns:", fileMetadata.Schema.NumColumns())
	}

	if len(selectedColumns) == 0 {
		for i := 0; i < fileMetadata.Schema.NumColumns(); i++ {
			selectedColumns = append(selectedColumns, i)
		}
	} else {
		for _, c := range selectedColumns {
			if c < 0 || c >= fileMetadata.Schema.NumColumns() {
				fmt.Fprintln(os.Stderr, "selected column is out of range")
				os.Exit(1)
			}
		}
	}

	if !config.NoMetadata {
		fmt.Println("Number of Selected Columns:", len(selectedColumns))
		for _, c := range selectedColumns {
			descr := fileMetadata.Schema.Column(c)
			fmt.Printf("Column %d: %s (%s", c, descr.Path(), descr.PhysicalType())
			if descr.ConvertedType() != schema.ConvertedTypes.None {
				fmt.Printf("/%s", descr.ConvertedType())
				if descr.ConvertedType() == schema.ConvertedTypes.Decimal {
					dec := descr.LogicalType().(schema.DecimalLogicalType)
					fmt.Printf("(%d,%d)", dec.Precision(), dec.Scale())
				}
			}
			fmt.Print(")\n")
		}
	}

	for r := 0; r < rdr.NumRowGroups(); r++ {
		if !config.NoMetadata {
			fmt.Println("--- Row Group:", r, " ---")
		}

		rgr := rdr.RowGroup(r)
		rowGroupMeta := rgr.MetaData()
		if !config.NoMetadata {
			fmt.Println("--- Total Bytes:", rowGroupMeta.TotalByteSize(), " ---")
			fmt.Println("--- Rows:", rgr.NumRows(), " ---")
		}

		for _, c := range selectedColumns {
			chunkMeta, err := rowGroupMeta.ColumnChunk(c)
			if err != nil {
				log.Fatal(err)
			}

			if !config.NoMetadata {
				fmt.Println("Column", c)
				if set, _ := chunkMeta.StatsSet(); set {
					stats, err := chunkMeta.Statistics()
					if err != nil {
						log.Fatal(err)
					}
					fmt.Printf(" Values: %d", chunkMeta.NumValues())
					if stats.HasMinMax() {
						fmt.Printf(", Min: %v, Max: %v",
							metadata.GetStatValue(stats.Type(), stats.EncodeMin()),
							metadata.GetStatValue(stats.Type(), stats.EncodeMax()))
					}
					if stats.HasNullCount() {
						fmt.Printf(", Null Values: %d", stats.NullCount())
					}
					if stats.HasDistinctCount() {
						fmt.Printf(", Distinct Values: %d", stats.DistinctCount())
					}
					fmt.Println()
				} else {
					fmt.Println(" Values:", chunkMeta.NumValues(), "Statistics Not Set")
				}

				fmt.Print(" Compression: ", chunkMeta.Compression())
				fmt.Print(", Encodings:")
				for _, enc := range chunkMeta.Encodings() {
					fmt.Print(" ", enc)
				}
				fmt.Println()

				fmt.Print(" Uncompressed Size: ", chunkMeta.TotalUncompressedSize())
				fmt.Println(", Compressed Size:", chunkMeta.TotalCompressedSize())
			}
		}

		if config.OnlyMetadata {
			continue
		}

		if !config.NoMetadata {
			fmt.Println("--- Values ---")
		}

		switch {
		case config.JSON:
			fmt.Fprint(dataOut, "[")

			scanners := make([]*Dumper, len(selectedColumns))
			fields := make([]string, len(selectedColumns))
			for idx, c := range selectedColumns {
				col, err := rgr.Column(c)
				if err != nil {
					log.Fatalf("unable to fetch column=%d err=%s", c, err)
				}
				scanners[idx] = createDumper(col)
				fields[idx] = col.Descriptor().Path()
			}

			var line string
			for {
				if line == "" {
					line = "\n  {"
				} else {
					line = ",\n  {"
				}

				data := false
				first := true
				for idx, s := range scanners {
					if val, ok := s.Next(); ok {
						if !data {
							fmt.Fprint(dataOut, line)
						}
						data = true
						if val == nil {
							continue
						}
						if !first {
							fmt.Fprint(dataOut, ",")
						}
						first = false
						switch val.(type) {
						case bool, int32, int64, float32, float64:
						default:
							val = s.FormatValue(val, 0)
						}
						jsonVal, err := json.Marshal(val)
						if err != nil {
							fmt.Fprintf(os.Stderr, "error: marshalling json for %+v, %s\n", val, err)
							os.Exit(1)
						}
						fmt.Fprintf(dataOut, "\n    %q: %s", fields[idx], jsonVal)
					}
				}
				if !data {
					break
				}
				fmt.Fprint(dataOut, "\n  }")
			}

			fmt.Fprintln(dataOut, "\n]")
		case config.CSV:
			scanners := make([]*Dumper, len(selectedColumns))
			for idx, c := range selectedColumns {
				if idx > 0 {
					fmt.Fprint(dataOut, ",")
				}
				col, err := rgr.Column(c)
				if err != nil {
					log.Fatalf("unable to fetch col=%d err=%s", c, err)
				}
				scanners[idx] = createDumper(col)
				fmt.Fprintf(dataOut, "%q", col.Descriptor().Path())
			}
			fmt.Fprintln(dataOut)

			var line string
			for {
				data := false
				for idx, s := range scanners {
					if idx > 0 {
						if data {
							fmt.Fprint(dataOut, ",")
						} else {
							line += ","
						}
					}
					if val, ok := s.Next(); ok {
						if !data {
							fmt.Fprint(dataOut, line)
						}
						data = true
						if val == nil {
							fmt.Fprint(dataOut, "")
							continue
						}
						switch val.(type) {
						case bool, int32, int64, parquet.Int96, float32, float64:
							fmt.Fprintf(dataOut, "%v", val)
						default:
							fmt.Fprintf(dataOut, "%q", s.FormatValue(val, 0))
						}
					} else {
						if data {
							fmt.Fprint(dataOut, ",")
						} else {
							line += ","
						}
					}
				}
				if !data {
					break
				}
				fmt.Fprintln(dataOut)
				line = ""
			}
			fmt.Fprintln(dataOut)
		default:
			const colwidth = 18

			scanners := make([]*Dumper, len(selectedColumns))
			for idx, c := range selectedColumns {
				col, err := rgr.Column(c)
				if err != nil {
					log.Fatalf("unable to fetch column=%d err=%s", c, err)
				}
				scanners[idx] = createDumper(col)
				fmt.Fprintf(dataOut, fmt.Sprintf("%%-%ds|", colwidth), col.Descriptor().Name())
			}
			fmt.Fprintln(dataOut)

			var line string
			for {
				data := false
				for _, s := range scanners {
					if val, ok := s.Next(); ok {
						if !data {
							fmt.Fprint(dataOut, line)
						}
						fmt.Fprint(dataOut, s.FormatValue(val, colwidth), "|")
						data = true
					} else {
						if data {
							fmt.Fprintf(dataOut, fmt.Sprintf("%%-%ds|", colwidth), "")
						} else {
							line += fmt.Sprintf(fmt.Sprintf("%%-%ds|", colwidth), "")
						}
					}
				}
				if !data {
					break
				}
				fmt.Fprintln(dataOut)
				line = ""
			}
			fmt.Fprintln(dataOut)
		}
	}
}
