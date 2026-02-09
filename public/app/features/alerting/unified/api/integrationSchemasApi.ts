import { useMemo } from 'react';

import {
  GetIntegrationtypeschemasField,
  GetIntegrationtypeschemasIntegrationTypeSchema,
  GetIntegrationtypeschemasIntegrationTypeSchemaVersion,
  useGetIntegrationtypeschemasQuery,
} from '@grafana/api-clients/rtkq/notifications.alerting/v0alpha1';
import { config } from '@grafana/runtime';

import { NotificationChannelOption, NotifierDTO, NotifierVersion } from '../types/alerting';

import { alertmanagerApi } from './alertmanagerApi';

const { useGrafanaNotifiersQuery } = alertmanagerApi;

/**
 * Transforms a k8s API field to NotificationChannelOption.
 * Explicitly maps all fields to ensure type safety without assertions.
 */
function transformField(field: GetIntegrationtypeschemasField, prefix = ''): NotificationChannelOption {
  const secureFieldKey = field.secure ? `${prefix}${field.propertyName}` : undefined;

  return {
    // Generated k8s API types use `string` for element; the backend returns valid element types
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    element: field.element as NotificationChannelOption['element'],
    inputType: field.inputType,
    label: field.label,
    description: field.description,
    placeholder: field.placeholder,
    propertyName: field.propertyName,
    required: field.required,
    secure: field.secure,
    secureFieldKey,
    protected: field.protected,
    selectOptions:
      field.selectOptions?.map((opt) => ({
        label: opt.label,
        value: opt.value,
        description: opt.description,
      })) ?? null,
    showWhen: {
      field: field.showWhen.field,
      is: field.showWhen.is,
    },
    validationRule: field.validationRule,
    subformOptions: field.subformOptions?.map((subfield) =>
      transformField(subfield, `${prefix}${field.propertyName}.`)
    ),
    dependsOn: field.dependsOn,
  };
}

/**
 * Transforms a k8s API version to NotifierVersion.
 */
function transformVersion(version: GetIntegrationtypeschemasIntegrationTypeSchemaVersion): NotifierVersion {
  return {
    version: version.version,
    label: version.version,
    description: '',
    options: version.options.map((field) => transformField(field)),
    canCreate: version.canCreate,
    deprecated: version.deprecated,
  };
}

/**
 * Transforms a k8s API schema to NotifierDTO format.
 * This is a type-safe transformation that explicitly maps all fields.
 */
function transformSchemaToNotifierDTO(schema: GetIntegrationtypeschemasIntegrationTypeSchema): NotifierDTO {
  return {
    // Generated k8s API types use `string` for type; the backend returns valid notifier types
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    type: schema.type as NotifierDTO['type'],
    name: schema.name,
    heading: schema.heading ?? '',
    description: schema.description ?? '',
    info: schema.info,
    currentVersion: schema.currentVersion,
    deprecated: schema.deprecated,
    // No top-level options - they come from versions in the new API
    versions: schema.versions.map(transformVersion),
  };
}

interface UseIntegrationTypeSchemasResult {
  data?: NotifierDTO[];
  isLoading: boolean;
  error?: unknown;
}

/**
 * Hook to fetch integration type schemas.
 * Uses new k8s API when feature flag is enabled, falls back to legacy API.
 */
export function useIntegrationTypeSchemas(options?: { skip?: boolean }): UseIntegrationTypeSchemasResult {
  const useNewApi = config.featureToggles.alertingSyncNotifiersApiMigration;
  const skip = options?.skip ?? false;

  const newApiResult = useGetIntegrationtypeschemasQuery(undefined, {
    skip: skip || !useNewApi,
  });
  const legacyResult = useGrafanaNotifiersQuery(undefined, {
    skip: skip || !!useNewApi,
  });

  return useMemo((): UseIntegrationTypeSchemasResult => {
    if (useNewApi) {
      return {
        ...newApiResult,
        data: newApiResult.data?.items.map((item) => transformSchemaToNotifierDTO(item.spec)),
      };
    }
    return legacyResult;
  }, [useNewApi, newApiResult, legacyResult]);
}
