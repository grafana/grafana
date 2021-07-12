package secrets

type secretKey struct {
	key func() []byte
}

func (s *secretKey) Encrypt(blob []byte) ([]byte, error) {
	return encrypt(blob, s.key())
}

func (s *secretKey) Decrypt(blob []byte) ([]byte, error) {
	return decrypt(blob, s.key())
}
