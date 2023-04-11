/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';

import { withAppEvents } from 'app/features/alerting/unified/utils/redux';
import { newDBClusterService } from 'app/percona/dbaas/components/DBCluster/DBCluster.utils';
import { SETTINGS_TIMEOUT } from 'app/percona/shared/core/constants';
import { prepareSourceRanges } from 'app/percona/shared/core/reducers/dbaas/dbaas.utils';
import { updateSettingsAction } from 'app/percona/shared/core/reducers/index';
import { getCronStringFromValues } from 'app/percona/shared/helpers/cron/cron';

import { AddDBClusterArgs, PerconaAddDBClusterState } from './addDBCluster.types';

export const initialAddDBClusterState: PerconaAddDBClusterState = {
  result: undefined,
  loading: undefined,
};

const perconaAddDBClusterSlice = createSlice({
  name: 'perconaAddDBCluster',
  initialState: initialAddDBClusterState,
  reducers: {
    resetAddDBClusterState: (state): PerconaAddDBClusterState => {
      return {
        ...state,
        result: undefined,
        loading: undefined,
      };
    },
    setAddDBClusterLoading: (state): PerconaAddDBClusterState => {
      return {
        ...state,
        loading: true,
      };
    },
    setAddDBClusterResult: (state, action): PerconaAddDBClusterState => {
      return {
        ...state,
        result: action.payload,
        loading: false,
      };
    },
  },
});

export const addDbClusterAction = createAsyncThunk(
  'percona/addDBCluster',
  async (args: AddDBClusterArgs, thunkAPI): Promise<void> => {
    const {
      name,
      kubernetesCluster,
      databaseType,
      databaseVersion,
      nodes,
      memory,
      cpu,
      disk,
      expose,
      internetFacing,
      sourceRanges,
      configuration,
      storageClass,
      restoreFrom,
      backupArtifact,
      backupLocation,
      retention,
      period,
      month,
      day,
      weekDay,
      startHour,
      startMinute,
      secretsName,
      enableRestore,
      enableBackups,
      template,
    } = args.values;

    const dbClusterService = newDBClusterService(databaseType.value);
    thunkAPI.dispatch(setAddDBClusterLoading());
    if (args.setPMMAddress) {
      await thunkAPI.dispatch(updateSettingsAction({ body: { pmm_public_address: window.location.host } }));
      await new Promise((resolve) => setTimeout(resolve, SETTINGS_TIMEOUT));
    }

    const cronExpression = getCronStringFromValues(
      period!.value!,
      month!.map((m: { value: any }) => m.value!),
      day!.map((m: { value: any }) => m.value!),
      weekDay!.map((m: { value: any }) => m.value!),
      startHour!.map((m: { value: any }) => m.value!),
      startMinute!.map((m: { value: any }) => m.value!)
    );

    const preparedSourceRanges = prepareSourceRanges(sourceRanges);

    await withAppEvents(
      dbClusterService.addDBCluster({
        kubernetesClusterName: kubernetesCluster?.value,
        clusterName: name,
        databaseType: databaseType?.value,
        clusterSize: nodes,
        cpu,
        memory,
        disk,
        databaseImage: databaseVersion?.value,
        expose,
        internetFacing,
        sourceRanges: preparedSourceRanges,
        configuration,
        ...(storageClass?.value && { storageClass: storageClass?.value }),
        ...(args.settings?.backupEnabled &&
          enableBackups && {
            backup: {
              cronExpression: cronExpression || '',
              locationId: backupLocation?.value || '',
              keepCopies: retention || '',
            },
          }),
        ...(args.settings?.backupEnabled &&
          enableRestore && {
            restore: {
              locationId: restoreFrom?.value || '',
              destination: backupArtifact?.value || '',
              secretsName: secretsName?.value || '',
            },
          }),
        ...(template && {
          template: {
            name: template.label,
            kind: template.value,
          },
        }),
      }),
      {
        successMessage: 'Cluster was successfully added',
      }
    )
      .then(() => {
        thunkAPI.dispatch(setAddDBClusterResult('ok'));
      })
      .catch(() => {
        thunkAPI.dispatch(setAddDBClusterResult('error'));
      });
  }
);

export const { setAddDBClusterResult, setAddDBClusterLoading, resetAddDBClusterState } =
  perconaAddDBClusterSlice.actions;
export default perconaAddDBClusterSlice.reducer;
