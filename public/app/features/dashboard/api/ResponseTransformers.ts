import { config } from '@grafana/runtime';
import { DataSourceRef } from '@grafana/schema';
import { Spec as DashboardV2Spec } from '@grafana/schema/dist/esm/schema/dashboard/v2';
import {
  AnnoKeyCreatedBy,
  AnnoKeyDashboardGnetId,
  AnnoKeyDashboardIsSnapshot,
  AnnoKeyDashboardSnapshotOriginalUrl,
  AnnoKeyFolder,
  AnnoKeySlug,
  AnnoKeyUpdatedBy,
  AnnoKeyUpdatedTimestamp,
  DeprecatedInternalId,
  ObjectMeta,
} from 'app/features/apiserver/types';
import { transformSaveModelSchemaV2ToScene } from 'app/features/dashboard-scene/serialization/transformSaveModelSchemaV2ToScene';
import { transformSaveModelToScene } from 'app/features/dashboard-scene/serialization/transformSaveModelToScene';
import { transformSceneToSaveModel } from 'app/features/dashboard-scene/serialization/transformSceneToSaveModel';
import {
  getDefaultDataSourceRef,
  transformSceneToSaveModelSchemaV2,
} from 'app/features/dashboard-scene/serialization/transformSceneToSaveModelSchemaV2';
import { DashboardDataDTO, DashboardDTO, DashboardRoutes } from 'app/types/dashboard';

import { DashboardWithAccessInfo } from './types';
import { isDashboardResource, isDashboardV2Resource, isDashboardV2Spec } from './utils';

export function ensureV2Response(
  dto: DashboardDTO | DashboardWithAccessInfo<DashboardDataDTO> | DashboardWithAccessInfo<DashboardV2Spec>
): DashboardWithAccessInfo<DashboardV2Spec> {
  if (isDashboardV2Resource(dto)) {
    return dto;
  }
  let dashboard: DashboardDataDTO;

  if (isDashboardResource(dto)) {
    dashboard = dto.spec;
  } else {
    dashboard = dto.dashboard;
  }

  let accessMeta: DashboardWithAccessInfo<DashboardV2Spec>['access'];
  let annotationsMeta: DashboardWithAccessInfo<DashboardV2Spec>['metadata']['annotations'];
  let labelsMeta: DashboardWithAccessInfo<DashboardV2Spec>['metadata']['labels'];
  let creationTimestamp;

  if (isDashboardResource(dto)) {
    accessMeta = dto.access;
    annotationsMeta = {
      ...dto.metadata.annotations,
      [AnnoKeyDashboardGnetId]: dashboard.gnetId ?? undefined,
    };
    creationTimestamp = dto.metadata.creationTimestamp;
    labelsMeta = {
      [DeprecatedInternalId]: dto.metadata.labels?.[DeprecatedInternalId],
    };
  } else {
    accessMeta = {
      url: dto.meta.url,
      slug: dto.meta.slug,
      canSave: dto.meta.canSave,
      canEdit: dto.meta.canEdit,
      canDelete: dto.meta.canDelete,
      canShare: dto.meta.canShare,
      canStar: dto.meta.canStar,
      canAdmin: dto.meta.canAdmin,
      annotationsPermissions: dto.meta.annotationsPermissions,
    };
    annotationsMeta = {
      [AnnoKeyCreatedBy]: dto.meta.createdBy,
      [AnnoKeyUpdatedBy]: dto.meta.updatedBy,
      [AnnoKeyUpdatedTimestamp]: dto.meta.updated,
      [AnnoKeyFolder]: dto.meta.folderUid,
      [AnnoKeySlug]: dto.meta.slug,
    };
    if (dashboard.gnetId) {
      annotationsMeta[AnnoKeyDashboardGnetId] = dashboard.gnetId;
    }
    if (dto.meta.isSnapshot) {
      // FIXME -- lets not put non-annotation data in annotations!
      annotationsMeta[AnnoKeyDashboardIsSnapshot] = 'true';
    }

    creationTimestamp = dto.meta.created;
    labelsMeta = {
      [DeprecatedInternalId]: dashboard.id?.toString() ?? undefined,
    };
  }

  if (annotationsMeta?.[AnnoKeyDashboardIsSnapshot]) {
    annotationsMeta[AnnoKeyDashboardSnapshotOriginalUrl] = dashboard.snapshot?.originalUrl;
  }

  const metadata = {
    creationTimestamp: creationTimestamp || '', // TODO verify this empty string is valid
    name: dashboard.uid,
    resourceVersion: dashboard.version?.toString() || '0',
    annotations: annotationsMeta,
    labels: labelsMeta,
  };

  if (!isDashboardResource(dto)) {
    if (isDashboardV2Spec(dto.dashboard)) {
      // sometimes we can have a v2 spec returned through legacy api like public dashboard
      // in that case we need to return dashboard as it is, since the conversion is not needed
      return {
        apiVersion: 'v2beta1',
        kind: 'DashboardWithAccessInfo',
        metadata,
        spec: dto.dashboard,
        access: accessMeta,
      };
    }
  }

  // Use scene-based transformation for v1 to v2 conversion
  // This ensures consistency with the rest of the codebase
  const meta = isDashboardResource(dto) ? {} : dto.meta;
  const scene = transformSaveModelToScene(
    { dashboard, meta: { isNew: false, isFolder: false, ...meta } },
    { uid: dashboard.uid ?? '', route: DashboardRoutes.Normal, forceSerializerVersion: 'v2' }
  );
  const spec = transformSceneToSaveModelSchemaV2(scene);

  return {
    apiVersion: 'v2beta1',
    kind: 'DashboardWithAccessInfo',
    metadata,
    spec,
    access: accessMeta,
  };
}

export const ResponseTransformers = {
  ensureV2Response,
};

export function getDefaultDatasource(): DataSourceRef {
  const defaultDataSourceRef = getDefaultDataSourceRef() ?? { type: 'grafana', uid: '-- Grafana --' };

  if (defaultDataSourceRef.uid && !defaultDataSourceRef.apiVersion) {
    // get api version from config
    const defaultDatasource = config.defaultDatasource;
    const dsInstance = config.datasources[defaultDatasource];
    defaultDataSourceRef.apiVersion = dsInstance.apiVersion ?? undefined;
  }

  return {
    apiVersion: defaultDataSourceRef.apiVersion,
    type: defaultDataSourceRef.type,
    uid: defaultDataSourceRef.uid,
  };
}

export function transformDashboardV2SpecToV1(spec: DashboardV2Spec, metadata: ObjectMeta): DashboardDataDTO {
  // Use scene-based transformation for v2 to v1 conversion
  // This ensures consistency with the rest of the codebase
  const scene = transformSaveModelSchemaV2ToScene({
    spec,
    metadata,
    apiVersion: 'v2beta1',
    access: {},
    kind: 'DashboardWithAccessInfo',
  });
  const dashboard = transformSceneToSaveModel(scene);
  // DashboardDataDTO requires title and uid to be defined, which the scene transformer guarantees from v2 spec
  return {
    ...dashboard,
    title: dashboard.title ?? spec.title,
    uid: dashboard.uid ?? metadata.name,
  };
}
