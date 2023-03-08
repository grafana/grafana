package dashboard

import "strconv"

type entityAnnotations struct {
	OrgID   int64
	Message string

	// General
	CreatedBy int64
	CreatedAt int64
	UpdatedBy int64
	UpdatedAt int64
	FolderID  int64 // can we skip this and lookup?
	FolderUID string

	// Provisioning
	PluginID   string
	OriginName string
	OriginPath string
	OriginKey  string
	OriginTime int64
}

const keyOrgID = "orgID"
const keyCreatedBy = "createdBy"
const keyCreatedAt = "createdAt"
const keyUpdatedBy = "updatedBy"
const keyUpdatedAt = "updatedAt"
const keyMessage = "message"
const keyPluginID = "plugin"
const keyFolderID = "folderID"
const keyFolderUID = "folderUID"
const keyOriginName = "originName"
const keyOriginPath = "originPath"
const keyOriginKey = "originKey"
const keyOriginTime = "originTime"

func (meta *entityAnnotations) Merge(anno map[string]string) {
	tmp := make(map[string]string)
	m := meta.ToMap() // Only the ones we should keep
	for k, v := range anno {
		if v == "" || m[k] != "" {
			continue
		}
		tmp[k] = v
	}
	meta.Read(tmp)
}

func (meta *entityAnnotations) Read(anno map[string]string) {
	meta.Message = anno[keyMessage]
	meta.PluginID = anno[keyPluginID]
	meta.FolderUID = anno[keyFolderUID]
	meta.OriginName = anno[keyOriginName]
	meta.OriginPath = anno[keyOriginPath]
	meta.OriginKey = anno[keyOriginKey]

	if v, ok := anno[keyOrgID]; ok {
		p, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			meta.OrgID = p
		}
	}

	if v, ok := anno[keyCreatedBy]; ok {
		p, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			meta.CreatedBy = p
		}
	}

	if v, ok := anno[keyCreatedAt]; ok {
		p, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			meta.CreatedAt = p
		}
	}

	if v, ok := anno[keyUpdatedBy]; ok {
		p, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			meta.UpdatedBy = p
		}
	}

	if v, ok := anno[keyUpdatedAt]; ok {
		p, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			meta.UpdatedAt = p
		}
	}

	if v, ok := anno[keyFolderID]; ok {
		p, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			meta.FolderID = p
		}
	}

	if v, ok := anno[keyOriginTime]; ok {
		p, err := strconv.ParseInt(v, 10, 64)
		if err == nil {
			meta.OriginTime = p
		}
	}
}

func (s *entityAnnotations) ToMap() map[string]string {
	anno := map[string]string{}
	if s.OrgID > 0 {
		anno[keyOrgID] = strconv.FormatInt(s.OrgID, 10)
	}
	if s.Message != "" {
		anno[keyMessage] = s.Message
	}
	if s.CreatedAt > 0 {
		anno[keyCreatedAt] = strconv.FormatInt(s.CreatedAt, 10)
	}
	if s.CreatedBy > 0 {
		anno[keyCreatedBy] = strconv.FormatInt(s.CreatedBy, 10)
	}
	if s.UpdatedAt > 0 {
		anno[keyUpdatedAt] = strconv.FormatInt(s.UpdatedAt, 10)
	}
	if s.UpdatedBy > 0 {
		anno[keyUpdatedBy] = strconv.FormatInt(s.UpdatedBy, 10)
	}
	if s.FolderID > 0 {
		anno[keyFolderID] = strconv.FormatInt(s.FolderID, 10)
	}
	if s.FolderUID != "" {
		anno[keyFolderUID] = s.FolderUID
	}
	if s.PluginID != "" {
		anno[keyPluginID] = s.PluginID
	}
	if s.OriginName != "" {
		anno[keyOriginName] = s.OriginName
	}
	if s.OriginPath != "" {
		anno[keyOriginPath] = s.OriginPath
	}
	if s.OriginKey != "" {
		anno[keyOriginKey] = s.OriginKey
	}
	if s.OriginTime > 0 {
		anno[keyOriginTime] = strconv.FormatInt(s.OriginTime, 10)
	}
	return anno
}
