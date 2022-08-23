package config

type Config struct {
	Version            string
	Bucket             string
	DebRepoBucket      string
	DebDBBucket        string
	RPMRepoBucket      string
	GPGPassPath        string
	GPGPrivateKey      string
	GPGPublicKey       string
	GCPKeyFile         string
	NumWorkers         int
	GitHubUser         string
	GitHubToken        string
	PullEnterprise     bool
	NetworkConcurrency bool
	PackageVersion     string
}
