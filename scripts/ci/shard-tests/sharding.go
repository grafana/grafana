package main

import "slices"

func ShardPackages(pkgs map[string]int, shardsTotal int) [][]string {
	sortedPkgs := make([]string, 0, len(pkgs))
	var totalTests int
	for pkg, testCount := range pkgs {
		sortedPkgs = append(sortedPkgs, pkg)
		totalTests += testCount
	}
	slices.Sort(sortedPkgs)

	shards := make([][]string, shardsTotal)
	shardSums := make([]int, shardsTotal)

	for _, pkg := range sortedPkgs {
		minShardIdx := 0
		for i := range shards {
			if shardSums[i] < shardSums[minShardIdx] {
				minShardIdx = i
			}
		}

		shards[minShardIdx] = append(shards[minShardIdx], pkg)
		shardSums[minShardIdx] += pkgs[pkg]
	}

	return shards
}
