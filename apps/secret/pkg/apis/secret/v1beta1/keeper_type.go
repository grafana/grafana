//
// THIS FILE IS MANUALLY GENERATED TO OVERCOME LIMITATIONS WITH CUE. FEEL FREE TO EDIT IT.
//

package v1beta1

// KeeperType represents the type of a Keeper.
type KeeperType string

const (
	AWSKeeperType       KeeperType = "aws"
	AzureKeeperType     KeeperType = "azure"
	GCPKeeperType       KeeperType = "gcp"
	HashiCorpKeeperType KeeperType = "hashicorp"
	SystemKeeperType    KeeperType = "system"
)

func (kt KeeperType) String() string {
	return string(kt)
}

// KeeperConfig is an interface that all keeper config types must implement.
type KeeperConfig interface {
	// Returns the name of the keeper
	GetName() string
	Type() KeeperType
}

type NamedKeeperConfig[T interface {
	Type() KeeperType
}] struct {
	Name string
	Cfg  T
}

func NewNamedKeeperConfig[T interface {
	Type() KeeperType
}](keeperName string, cfg T) *NamedKeeperConfig[T] {
	return &NamedKeeperConfig[T]{Name: keeperName, Cfg: cfg}
}

func (c *NamedKeeperConfig[T]) GetName() string {
	return c.Name
}
func (c *NamedKeeperConfig[T]) Type() KeeperType {
	return c.Cfg.Type()
}

func (s *KeeperSpec) GetType() KeeperType {
	if s.Aws != nil {
		return AWSKeeperType
	}
	if s.Azure != nil {
		return AzureKeeperType
	}
	if s.Gcp != nil {
		return GCPKeeperType
	}
	if s.HashiCorpVault != nil {
		return HashiCorpKeeperType
	}
	return ""
}

// System Keeper.
type SystemKeeperConfig struct{}

func (*SystemKeeperConfig) Type() KeeperType {
	return SystemKeeperType
}

func (s *KeeperAWSConfig) Type() KeeperType {
	return AWSKeeperType
}

func (s *KeeperAzureConfig) Type() KeeperType {
	return AzureKeeperType
}

func (s *KeeperGCPConfig) Type() KeeperType {
	return GCPKeeperType
}

func (s *KeeperHashiCorpConfig) Type() KeeperType {
	return HashiCorpKeeperType
}
