package request

type Dimension struct {
	Name  string
	Value string
}

type Account struct {
	Id    string `json:"id"`
	Arn   string `json:"arn,omitempty"`
	Label string `json:"label,omitempty"`
}
