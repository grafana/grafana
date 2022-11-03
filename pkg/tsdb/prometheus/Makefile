GO = go
SHELL = /bin/zsh

ITERATIONS=10
BENCH=repeat $(ITERATIONS) $(LEFT_BRACKET) $(GO) test -benchmem -run=^$$ -bench
PROFILE=$(GO) test -benchmem -run=^$$ -benchtime 1x -memprofile memprofile.out -memprofilerate 1 -cpuprofile cpuprofile.out  -bench

LEFT_BRACKET = {
RIGHT_BRACKET = }

memprofile-exemplar memprofile-range: %: --%
	$(GO) tool pprof -http=localhost:6061 memprofile.out

cpuprofile-exemplar cpuprofile-range: %: --%
	$(GO) tool pprof -http=localhost:6061 cpuprofile.out

benchmark-exemplar benchmark-range: %: --%
	sed -i 's/buffered/querydata/g' old.txt
	benchstat old.txt new.txt
	rm old.txt new.txt

--benchmark-range:
	$(BENCH) ^BenchmarkRangeJson ./buffered >> old.txt $(RIGHT_BRACKET)
	$(BENCH) ^BenchmarkRangeJson ./querydata >> new.txt $(RIGHT_BRACKET)

--memprofile-range:
	$(PROFILE) ^BenchmarkRangeJson ./querydata

--cpuprofile-range:
	$(PROFILE) ^BenchmarkRangeJson ./querydata

--benchmark-exemplar:
	$(BENCH) ^BenchmarkExemplarJson ./buffered >> old.txt $(RIGHT_BRACKET)
	$(BENCH) ^BenchmarkExemplarJson ./querydata >> new.txt $(RIGHT_BRACKET)

--memprofile-exemplar:
	$(PROFILE) ^BenchmarkExemplarJson ./querydata

--cpuprofile-exemplar:
	$(PROFILE) ^BenchmarkExemplarJson ./querydata

.PHONY: benchmark-range benchmark-exemplar memprofile-range memprofile-exemplar cpuprofile-range cpuprofile-exemplar