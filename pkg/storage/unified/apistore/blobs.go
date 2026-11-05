package apistore

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"mime"
	"reflect"
	"sort"

	apierrors "k8s.io/apimachinery/pkg/api/errors"
	"k8s.io/apimachinery/pkg/runtime"

	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/storage/unified/resourceclient/resourceutil"
	"github.com/grafana/grafana/pkg/storage/unified/resourcepb"
)

// prepareInlineBlobs only changes the serialized unified copy. In dual-write
// modes the legacy writer must still receive the original write input.
func (s *Storage) prepareInlineBlobs(ctx context.Context, raw json.RawMessage, key *resourcepb.ResourceKey, obj runtime.Object) (json.RawMessage, error) {
	fields, err := resourcepb.DecodeBlobObject(raw)
	if err != nil {
		return nil, apierrors.NewBadRequest(err.Error())
	}
	blobJSON, present := fields["blobs"]
	if !present || bytes.Equal(bytes.TrimSpace(blobJSON), []byte("null")) {
		return raw, nil
	}
	blobs, err := resourcepb.DecodeBlobObject(blobJSON)
	if err != nil {
		return nil, apierrors.NewBadRequest(err.Error())
	}
	inline := make(map[string]json.RawMessage)
	for name, raw := range blobs {
		var fields map[string]json.RawMessage
		if err := json.Unmarshal(raw, &fields); err != nil {
			return nil, apierrors.NewBadRequest(fmt.Sprintf("blobs.%s: %s", name, err))
		}
		if _, present := fields["data"]; present {
			inline[name] = raw
		}
	}
	if len(inline) == 0 {
		return raw, nil
	}
	if !s.opts.EnableInlineBlobs {
		return nil, apierrors.NewBadRequest("inline blobs are not enabled for this resource")
	}
	if len(blobs) > resourcepb.MaxInlineBlobEntries {
		return nil, apierrors.NewBadRequest(fmt.Sprintf("inline blobs allow at most %d entries", resourcepb.MaxInlineBlobEntries))
	}
	// Existing references may have empty UIDs or legacy metadata. Only entries
	// carrying data opt into the stricter write-input contract.
	inlineJSON, err := json.Marshal(inline)
	if err != nil {
		return nil, err
	}
	entries, err := resourcepb.DecodeBlobEntries(inlineJSON)
	if err != nil {
		return nil, apierrors.NewBadRequest(err.Error())
	}
	meta, err := utils.MetaAccessor(obj)
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(entries))
	for name := range entries {
		names = append(names, name)
	}
	sort.Strings(names)
	for _, name := range names {
		entry := entries[name]
		rsp, err := s.store.PutBlob(ctx, &resourcepb.PutBlobRequest{
			Resource: key, Folder: meta.GetFolder(), Method: resourcepb.PutBlobRequest_GRPC,
			ContentType: entry.ContentType, Value: entry.Data,
		})
		if err := resourceutil.StatusErrorFromResponse(rsp.GetError(), err); err != nil {
			return nil, err
		}
		mediaType, params, err := mime.ParseMediaType(entry.ContentType)
		if err != nil {
			return nil, apierrors.NewBadRequest("invalid blob upload content type")
		}
		responseType, _, responseErr := mime.ParseMediaType(rsp.GetMimeType())
		if rsp.GetUid() == "" || rsp.GetSize() != int64(len(entry.Data)) || responseErr != nil || responseType != mediaType {
			return nil, apierrors.NewInternalError(fmt.Errorf("invalid blob upload response for %q", name))
		}
		if rsp.Charset != "" {
			params["charset"] = rsp.Charset
		}
		blobs[name], err = json.Marshal(resourcepb.BlobReference{
			UID: rsp.Uid, ContentType: mime.FormatMediaType(mediaType, params), Size: rsp.Size, Hash: rsp.Hash,
		})
		if err != nil {
			return nil, err
		}
	}
	fields["blobs"], err = json.Marshal(blobs)
	if err != nil {
		return nil, err
	}
	// kubectl's last-applied configuration can contain the entire inline input.
	// Do not persist a second copy of the bytes in metadata.
	var metadata map[string]json.RawMessage
	if err := json.Unmarshal(fields["metadata"], &metadata); err != nil {
		return nil, err
	}
	if annotationsJSON, ok := metadata["annotations"]; ok {
		var annotations map[string]json.RawMessage
		if err := json.Unmarshal(annotationsJSON, &annotations); err != nil {
			return nil, err
		}
		delete(annotations, utils.AnnoKeyKubectlLastAppliedConfig)
		metadata["annotations"], err = json.Marshal(annotations)
		if err != nil {
			return nil, err
		}
		fields["metadata"], err = json.Marshal(metadata)
		if err != nil {
			return nil, err
		}
	}
	// Uploads are not transactional with resource writes. Leave failed-attempt
	// blobs for eventual GC: a transport error may follow a committed write.
	return json.Marshal(fields)
}

func (s *Storage) blobsChanged(ctx context.Context, obj, previous runtime.Object) (bool, error) {
	values := make([]any, 2)
	for i, object := range []runtime.Object{obj, previous} {
		raw, err := s.serializer.Encode(ctx, object)
		if err != nil {
			return false, err
		}
		var fields map[string]json.RawMessage
		if err := json.Unmarshal(raw, &fields); err != nil {
			return false, err
		}
		if raw, ok := fields["blobs"]; ok {
			decoder := json.NewDecoder(bytes.NewReader(raw))
			decoder.UseNumber()
			if err := decoder.Decode(&values[i]); err != nil {
				return false, err
			}
		}
	}
	return !reflect.DeepEqual(values[0], values[1]), nil
}
