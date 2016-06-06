package graphite

type TargetResponseDTO struct {
	Target     string       `json:"target"`
	DataPoints [][2]float64 `json:"datapoints"`
}
