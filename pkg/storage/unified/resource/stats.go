package resource

import "time"

type SearchStats struct {
	operation string
	startTime time.Time // Time when the operation.

	indexBuildTime  time.Duration // Time to build indexes if it wasn't open before.
	indexUpdateTime time.Duration // Time to update indexes to the latest state.

	requestConversion time.Duration // How long does it take to convert search request to the bleve query

	searchTime        time.Duration
	totalHits         int // Total hits across all pages
	returnedDocuments int // Hits returned in this page

	resultsConversionTime time.Duration // How long does it take to convert search results to final results.
}

func NewSearchStats(op string) *SearchStats {
	return &SearchStats{operation: op, startTime: time.Now()}
}

func (s *SearchStats) AddIndexBuildTime(d time.Duration) {
	if s != nil {
		s.indexBuildTime += d
	}
}

func (s *SearchStats) AddIndexUpdateTime(d time.Duration) {
	if s != nil {
		s.indexUpdateTime += d
	}
}

func (s *SearchStats) AddRequestConversionTime(d time.Duration) {
	if s != nil {
		s.requestConversion += d
	}
}

func (s *SearchStats) AddSearchTime(d time.Duration) {
	if s != nil {
		s.searchTime += d
	}
}

func (s *SearchStats) AddTotalHits(total int) {
	if s != nil {
		s.totalHits += total
	}
}

func (s *SearchStats) AddReturnedDocuments(docs int) {
	if s != nil {
		s.returnedDocuments += docs
	}
}

func (s *SearchStats) AddResultsConversionTime(d time.Duration) {
	if s != nil {
		s.resultsConversionTime += d
	}
}
