import { type QueryReturnValue } from '@reduxjs/toolkit/query/react';

import { type ConvertAlertmanagerResponse, convertAPI } from '@grafana/alerting/convert';

import {
  type NotificationsSourceParams,
  resolveAlertmanagerConfig,
} from '../components/import-to-gma/resolveAlertmanagerConfig';

import { alertingApi } from './alertingApi';
import { ALERTMANAGER_PROVIDED_ENTITY_TAGS } from './alertmanagerApi';

// Whether the request succeeded. Its errors reach the caller through the mutation itself.
async function succeeded(queryFulfilled: Promise<unknown>): Promise<boolean> {
  try {
    await queryFulfilled;
    return true;
  } catch {
    return false;
  }
}

// Alertmanager imports change the config that `alertingApi` caches, and one RTKQ client can't refetch
// another's data through its tags, so each of these endpoints asks `alertingApi` to refetch once it succeeds.
const convertApiWithRefetches = convertAPI.enhanceEndpoints({
  endpoints: {
    postAlertmanagerConfig: {
      async onQueryStarted({ dryRun, promote }, { dispatch, queryFulfilled }) {
        if (!(await succeeded(queryFulfilled))) {
          return;
        }
        // A dry run changes nothing.
        if (dryRun) {
          return;
        }
        // A staged import lands on the config's extra_config, so the config has to be fetched again,
        // or the Import tab shows its old copy. Promoting also changes the contact points.
        dispatch(
          alertingApi.util.invalidateTags(
            promote ? [...ALERTMANAGER_PROVIDED_ENTITY_TAGS] : ['AlertmanagerConfiguration']
          )
        );
      },
    },
    promoteAlertmanagerConfig: {
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        if (!(await succeeded(queryFulfilled))) {
          return;
        }
        // Promoting merges the staged config into the live one, which changes the contact points too.
        dispatch(alertingApi.util.invalidateTags([...ALERTMANAGER_PROVIDED_ENTITY_TAGS]));
      },
    },
    deleteAlertmanagerConfig: {
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        if (!(await succeeded(queryFulfilled))) {
          return;
        }
        // The staged config lives inside the Alertmanager config, so fetching it again removes the staged card.
        dispatch(alertingApi.util.invalidateTags(['AlertmanagerConfiguration']));
      },
    },
  },
});

/** Args for the wizard's interactive dry-run validation. No `promote` — the wizard never promotes from Step 1. */
export type ValidateAlertmanagerConfigImportArgs = Omit<NotificationsSourceParams, 'promote'>;

function fileSignature(file: File): string {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

/**
 * Built from stable fields, not the raw args, since `File` has no own enumerable properties to
 * key on. Prefixed with the endpoint's own name since the cache-key namespace is shared across `convertApi`.
 */
function serializeValidateAlertmanagerConfigImportArgs(queryArgs: ValidateAlertmanagerConfigImportArgs): string {
  const { source, yamlFile, templateFiles = [], datasourceName, configIdentifier } = queryArgs;
  const signature =
    source === 'yaml'
      ? {
          source,
          file: yamlFile ? fileSignature(yamlFile) : null,
          templates: templateFiles.map(fileSignature).sort(),
          configIdentifier,
        }
      : { source, datasourceName, configIdentifier };
  return `validateAlertmanagerConfigImport(${JSON.stringify(signature)})`;
}

/**
 * The convert API client from `@grafana/alerting/convert`, with the refetches Grafana's own alerting
 * screens need and the import wizard's dry-run validation.
 */
export const convertApi = convertApiWithRefetches.injectEndpoints({
  endpoints: (build) => ({
    /**
     * Interactive Step 1 dry-run validation, keyed by a signature of the inputs so each edit gets
     * its own isolated cache entry. Sends the request through the Alertmanager import endpoint, as a dry run.
     */
    validateAlertmanagerConfigImport: build.query<ConvertAlertmanagerResponse, ValidateAlertmanagerConfigImportArgs>({
      serializeQueryArgs: ({ queryArgs }) => serializeValidateAlertmanagerConfigImportArgs(queryArgs),
      queryFn: async (
        args,
        { dispatch }
      ): Promise<QueryReturnValue<ConvertAlertmanagerResponse, unknown, {} | undefined>> => {
        let resolved;
        try {
          resolved = await resolveAlertmanagerConfig(args);
        } catch (err) {
          return { error: err instanceof Error ? err : new Error(String(err)) };
        }

        try {
          const data = await dispatch(
            convertApiWithRefetches.endpoints.postAlertmanagerConfig.initiate({
              payload: resolved,
              identifier: args.configIdentifier,
              dryRun: true,
              // Force-replace so validation isn't blocked by a 409 from an existing identifier.
              forceReplace: true,
            })
          ).unwrap();
          return { data };
        } catch (error) {
          return { error };
        }
      },
    }),
  }),
});
