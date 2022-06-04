GO = go
SHELL = /bin/zsh

benchmark-range:
	$(shell repeat 10 {$(GO) test -benchmem -run=^$$ -bench ^BenchmarkRangeJson ./buffered >> old.txt})
	$(shell repeat 10 {$(GO) test -benchmem -run=^$$ -bench ^BenchmarkJson ./querydata >> new.txt})
	sed -i 's/buffered/querydata/g' old.txt
	benchstat old.txt new.txt
	rm old.txt new.txt

benchmark-exemplar:
	$(shell repeat 10 {$(GO) test -benchmem -run=^$$ -bench ^BenchmarkExemplarJson ./buffered >> old.txt})
	$(shell repeat 10 {$(GO) test -benchmem -run=^$$ -bench ^BenchmarkExemplarJson ./querydata >> new.txt})
	sed -i 's/buffered/querydata/g' old.txt
	benchstat old.txt new.txt
	rm old.txt new.txt

.PHONY: benchmark-range benchmark-exemplar