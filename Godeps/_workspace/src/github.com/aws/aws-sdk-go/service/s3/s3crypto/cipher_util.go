package s3crypto

import (
	"encoding/base64"
	"strconv"

	"github.com/aws/aws-sdk-go/aws/awserr"
)

func (client *DecryptionClient) contentCipherFromEnvelope(env Envelope) (ContentCipher, error) {
	wrap, err := client.wrapFromEnvelope(env)
	if err != nil {
		return nil, err
	}

	return client.cekFromEnvelope(env, wrap)
}

func (client *DecryptionClient) wrapFromEnvelope(env Envelope) (CipherDataDecrypter, error) {
	f, ok := client.WrapRegistry[env.WrapAlg]
	if !ok || f == nil {
		return nil, awserr.New(
			"InvalidWrapAlgorithmError",
			"wrap algorithm isn't supported, "+env.WrapAlg,
			nil,
		)
	}
	return f(env)
}

// AESGCMNoPadding is the constant value that is used to specify
// the CEK algorithm consiting of AES GCM with no padding.
const AESGCMNoPadding = "AES/GCM/NoPadding"

func (client *DecryptionClient) cekFromEnvelope(env Envelope, decrypter CipherDataDecrypter) (ContentCipher, error) {
	f, ok := client.CEKRegistry[env.CEKAlg]
	if !ok || f == nil {
		return nil, awserr.New(
			"InvalidCEKAlgorithmError",
			"cek algorithm isn't supported, "+env.CEKAlg,
			nil,
		)
	}

	key, err := base64.StdEncoding.DecodeString(env.CipherKey)
	if err != nil {
		return nil, err
	}

	iv, err := base64.StdEncoding.DecodeString(env.IV)
	if err != nil {
		return nil, err
	}
	key, err = decrypter.DecryptKey(key)
	if err != nil {
		return nil, err
	}

	cd := CipherData{
		Key: key,
		IV:  iv,
	}
	return f(cd)
}

func encodeMeta(reader hashReader, cd CipherData) (Envelope, error) {
	iv := base64.StdEncoding.EncodeToString(cd.IV)
	key := base64.StdEncoding.EncodeToString(cd.EncryptedKey)

	md5 := reader.GetValue()
	contentLength := reader.GetContentLength()

	md5Str := base64.StdEncoding.EncodeToString(md5)
	matdesc, err := cd.MaterialDescription.encodeDescription()
	if err != nil {
		return Envelope{}, err
	}

	return Envelope{
		CipherKey:             key,
		IV:                    iv,
		MatDesc:               string(matdesc),
		WrapAlg:               cd.WrapAlgorithm,
		CEKAlg:                cd.CEKAlgorithm,
		TagLen:                cd.TagLength,
		UnencryptedMD5:        md5Str,
		UnencryptedContentLen: strconv.FormatInt(contentLength, 10),
	}, nil
}
