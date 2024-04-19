#!/bin/bash

go test -v -run=^# -bench BenchmarkSortAlertsByImportance -count 5 -topk sort | tee before.txt
go test -v -run=^# -bench BenchmarkSortAlertsByImportance -count 5 -topk heap | tee after.txt
benchstat before.txt after.txt
