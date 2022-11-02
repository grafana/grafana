package resources

type Dimension struct {
	Name  string
	Value string
}

type ResourceResponse[T any] struct {
	AccountId *string `json:"accountId,omitempty"`
	Value     T       `json:"value"`
}

type Account struct {
	Id    string `json:"id"`
	Arn   string `json:"arn,omitempty"`
	Label string `json:"label,omitempty"`
}

type Metric struct {
	Name      string `json:"name"`
	Namespace string `json:"namespace"`

