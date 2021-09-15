package encryption

type Service interface {
	Encrypt([]byte, string) ([]byte, error)
	Decrypt([]byte, string) ([]byte, error)

	EncryptJsonData(map[string]string, string) (map[string][]byte, error)
	DecryptJsonData(map[string][]byte, string) (map[string]string, error)

	GetDecryptedValue(map[string][]byte, string, string, string) string
}
