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
)

func (kt KeeperType) String() string {
	return string(kt)
}

// KeeperConfig is an interface that all keeper config types must implement.
type KeeperConfig interface {
	Type() KeeperType
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
	return "system"
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
