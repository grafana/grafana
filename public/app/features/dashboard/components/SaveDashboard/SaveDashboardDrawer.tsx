import React, { useMemo, useState } from 'react';
import { css } from '@emotion/css';
import {
  Alert,
  Button,
  Checkbox,
  CustomScrollbar,
  Drawer,
  Field,
  HorizontalGroup,
  Icon,
  Input,
  InputControl,
  RadioButtonGroup,
  Select,
  Spinner,
  Tab,
  TabContent,
  TabsBar,
  TextArea,
  useStyles2,
  VerticalGroup,
} from '@grafana/ui';
import { useForm, useWatch } from 'react-hook-form';
import { SaveDashboardModalProps } from './types';
import { GrafanaTheme2 } from '@grafana/data';
import { DiffViewer } from '../VersionHistory/DiffViewer';
import { jsonDiff } from '../VersionHistory/utils';
import { DiffGroup } from '../VersionHistory/DiffGroup';
import { selectors } from '@grafana/e2e-selectors';
import { useAsync } from 'react-use';
import { backendSrv } from 'app/core/services/backend_srv';
import { getBackendSrv, getLocationSrv } from '@grafana/runtime';
import { RootStorageMeta } from 'app/features/storage/types';
import { getIconName } from 'app/features/storage/StorageList';
import { isObject } from 'lodash';
import kbn from 'app/core/utils/kbn';

interface FormDTO {
  action?: string; //
  title?: string;
  message?: string;

  newDashboardTitle?: string;
  newDashboardStore?: string;
  newDashboardPath?: string;
}

const actionOptions = [
  {
    label: 'Push to main',
    value: 'save',
  },
  {
    label: 'Submit pull request',
    value: 'pr',
  },
];

const storeOptions = [
  {
    label: 'it-A', // ???? not working !!!! Git instance A',
    value: 'it-A',
  },
  {
    label: 'it-B', // 'Git instance B',
    value: 'it-B',
  },
  {
    label: 'dev-dashboards',
    value: 'dev-dashboards',
  },
];

interface WriteValueResponse {
  code: number;
  message?: string;
  url?: string;
  hash?: string;
  branch?: string;
  pending?: boolean;
  size?: number;
}

export const SaveDashboardDrawer = ({ dashboard, onDismiss }: SaveDashboardModalProps) => {
  const styles = useStyles2(getStyles);
  const {
    handleSubmit,
    control,
    register,
    formState: { errors },
    setValue,
  } = useForm<FormDTO>({ defaultValues: { action: 'save' } });
  const hasTimeChanged = useMemo(() => dashboard.hasTimeChanged(), [dashboard]);
  const hasVariableChanged = useMemo(() => dashboard.hasVariableValuesChanged(), [dashboard]);
  const currentValue = useWatch({ control });

  const [saveTimeRange, setSaveTimeRange] = useState(false);
  const [saveVariables, setSaveVariables] = useState(false);

  const isNew = useMemo(() => {
    const v = dashboard.version === 0 && !dashboard.uid;
    if (v) {
      currentValue.newDashboardStore = storeOptions[0].value;
      setValue('newDashboardStore', storeOptions[0].value);
    }
    return v;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboard, setValue]);

  // Weirdly the select returns the whole item *OR* a string :(
  const keyFromStorage = (v: any) => {
    if (isObject(v)) {
      return (v as any).value as string; // !!!!!!!
    }
    return v ? (v as string) : '';
  };

  const storage = useAsync(async () => {
    let key = keyFromStorage(currentValue.newDashboardStore);
    const uid = dashboard.uid ?? '';
    const idx = uid.indexOf('/');
    if (idx > 0) {
      key = dashboard.uid.substring(0, idx);
    }
    if (!key) {
      return {
        isGit: false,
        isDirect: false,
      };
    }

    const status = (await getBackendSrv().get(`api/storage/root/${key}`)) as RootStorageMeta;
    return {
      isGit: status.config.type === 'git',
      isDirect: status.config.type === 'disk',
      status,
    };
  }, [dashboard, currentValue.newDashboardStore]);

  const previous = useAsync(async () => {
    if (isNew) {
      return undefined;
    }

    const slug = dashboard.uid;
    const result = await backendSrv.getDashboardByPath(slug);
    result.dashboard.uid = slug;
    delete result.dashboard.id;
    result.dashboard.version = dashboard.version; // just to avoid issues
    return result.dashboard;
  }, [dashboard, isNew]);

  const data = useMemo(() => {
    const clone = dashboard.getSaveModelClone({
      saveTimerange: Boolean(saveTimeRange),
      saveVariables: Boolean(saveVariables),
    });

    if (!previous.value) {
      return { clone };
    }

    const cloneJSON = JSON.stringify(clone, null, 2);
    const cloneSafe = JSON.parse(cloneJSON); // avoids undefined issues

    const diff = jsonDiff(previous.value, cloneSafe);
    let diffCount = 0;
    for (const d of Object.values(diff)) {
      diffCount += d.length;
    }

    return {
      clone,
      cloneJSON,
      diff,
      diffCount,
      hasChanges: diffCount > 0,
    };
  }, [dashboard, previous.value, saveTimeRange, saveVariables]);

  const [showDiff, setShowDiff] = useState(false);
  const [rsp, setRsp] = useState<WriteValueResponse>();
  const [saving, setSaving] = useState(false);

  const doSave = async (dto: FormDTO) => {
    setSaving(true);

    const body = data.clone;
    let path = dashboard.uid;
    if (isNew) {
      const title = currentValue.newDashboardTitle ?? 'New Dashboard';
      path = keyFromStorage(currentValue.newDashboardStore) + '/';
      if (currentValue.newDashboardPath) {
        path += currentValue.newDashboardPath;
        if (!path.endsWith('/')) {
          path += '/';
        }
      }
      path += kbn.slugifyForUrl(title);
      body.title = title;
    }

    try {
      const rsp = (await backendSrv.post(`/api/dashboards/path/${path}`, {
        body: data.clone,
        message: dto.message ?? '',
        title: dto.title,
        action: dto.action,
      })) as WriteValueResponse;

      // It is OK
      if (rsp.code === 200 && !rsp.pending) {
        dashboard.clearUnsavedChanges();
        onDismiss();
        if (isNew) {
          dashboard.meta.canSave = false;
          getLocationSrv().update({
            path: `/g/${path}`,
          });
        }
      }

      setRsp(rsp);
      console.log('Results', rsp);
    } catch (e) {
      console.log('ERROR', e);
    }

    setSaving(false);
  };

  const isGit = storage.value?.isGit;
  const isDirect = storage.value?.isDirect;

  const getActionName = () => {
    if (isGit) {
      if (currentValue.action === 'pr') {
        return 'Submit';
      }
      return 'Push';
    }
    return 'Save';
  };

  const renderLocationInfo = () => {
    if (isNew) {
      return (
        <InputControl
          name="newDashboardStore"
          control={control}
          rules={{
            required: true,
          }}
          render={({ field }) => <Select menuShouldPortal {...field} options={storeOptions} />}
        />
      );
    }

    const icon = <Icon name={getIconName(storage.value?.status?.config.type ?? '')} />;
    if (isGit) {
      const url = storage.value?.status?.config.git?.remote;
      if (url) {
        return (
          <HorizontalGroup>
            {icon}
            <a href={url}>{url}</a>
          </HorizontalGroup>
        );
      }
    }
    if (storage.loading) {
      return <Spinner />;
    }
    return (
      <HorizontalGroup>
        {icon}
        {storage.value?.status?.config.name}
      </HorizontalGroup>
    );
  };

  return (
    <Drawer
      title={dashboard.title}
      onClose={onDismiss}
      width={'40%'}
      subtitle={
        <>
          {hasTimeChanged && (
            <Checkbox
              checked={saveTimeRange}
              onChange={() => setSaveTimeRange(!saveTimeRange)}
              label="Save current time range as dashboard default"
              aria-label={selectors.pages.SaveDashboardModal.saveTimerange}
            />
          )}
          {hasVariableChanged && (
            <Checkbox
              checked={saveVariables}
              onChange={() => setSaveVariables(!saveVariables)}
              label="Save current variable values as dashboard default"
              aria-label={selectors.pages.SaveDashboardModal.saveVariables}
            />
          )}
          <TabsBar className={styles.tabsBar}>
            <Tab label={'Save'} active={!showDiff} onChangeTab={() => setShowDiff(false)} />
            {data.hasChanges && (
              <Tab label={'Changes'} active={showDiff} onChangeTab={() => setShowDiff(true)} counter={data.diffCount} />
            )}
          </TabsBar>
        </>
      }
      expandable
    >
      <CustomScrollbar autoHeightMin="100%">
        <TabContent>
          {showDiff && !rsp && (
            <>
              {previous.loading && <Spinner />}
              {!data.hasChanges && <div>No changes made to this dashboard</div>}
              {data.diff && data.hasChanges && (
                <div>
                  <div className={styles.spacer}>
                    {Object.entries(data.diff).map(([key, diffs]) => (
                      <DiffGroup diffs={diffs} key={key} title={key} />
                    ))}
                  </div>

                  <h4>JSON Diff</h4>
                  <DiffViewer oldValue={JSON.stringify(previous.value, null, 2)} newValue={data.cloneJSON!} />
                </div>
              )}
            </>
          )}
          {!showDiff && !rsp && (
            <form onSubmit={handleSubmit(doSave)}>
              <Field label="Location">{renderLocationInfo()}</Field>
              {isDirect && (
                <>
                  <Alert title="Writing directly to a non-versioned file system" severity="info" />
                </>
              )}

              {isNew && (
                <>
                  <Field label="Dashboard title" invalid={!!errors.newDashboardTitle} error="Title is required">
                    <Input {...register('newDashboardTitle', { required: true })} placeholder="Set dashboard title" />
                  </Field>
                  <Field label="Dashboard folder">
                    <Input {...register('newDashboardPath', { required: false })} placeholder="root folder" />
                  </Field>
                </>
              )}

              {storage.value?.isGit && (
                <Field label="Workflow">
                  <InputControl
                    name="action"
                    control={control}
                    render={({ field }) => <RadioButtonGroup {...field} options={actionOptions} />}
                  />
                </Field>
              )}

              {isGit && currentValue.action === 'pr' && (
                <>
                  <Field label="Pull request title" invalid={!!errors.title} error="Pull requests need a title">
                    <Input {...register('title', { required: isGit })} placeholder="Set title on pull request" />
                  </Field>
                </>
              )}

              {!isDirect && (
                <Field label="Message" invalid={!!errors.message} error="Message is required">
                  <TextArea
                    {...register('message', { required: isGit })}
                    rows={5}
                    placeholder="Add a note to describe your changes."
                  />
                </Field>
              )}

              <HorizontalGroup>
                <Button
                  type="submit"
                  aria-label="Save dashboard button"
                  disabled={!data.hasChanges && !isNew}
                  icon={saving ? 'fa fa-spinner' : undefined}
                >
                  {saving ? '' : getActionName()}
                </Button>
                <Button type="button" variant="secondary" onClick={onDismiss} fill="outline">
                  Cancel
                </Button>
              </HorizontalGroup>
              {!data.hasChanges && !isNew && <div className={styles.nothing}>No changes to save</div>}
            </form>
          )}
          {rsp && (
            <div>
              {false && <pre>{JSON.stringify(rsp, null, 2)}</pre>}
              {rsp.url && (
                <>
                  <Alert title={'Pull request created'} severity="success">
                    <VerticalGroup>
                      <a href={rsp.url}>{rsp.url}</a>
                    </VerticalGroup>
                  </Alert>
                  <HorizontalGroup>
                    <Button type="button" variant="secondary" onClick={onDismiss}>
                      Close
                    </Button>
                  </HorizontalGroup>
                </>
              )}
            </div>
          )}
        </TabContent>
      </CustomScrollbar>
    </Drawer>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  tabsBar: css`
    padding-left: ${theme.v1.spacing.md};
    margin: ${theme.v1.spacing.lg} -${theme.v1.spacing.sm} -${theme.v1.spacing.lg} -${theme.v1.spacing.lg};
  `,
  spacer: css`
    margin-bottom: ${theme.v1.spacing.xl};
  `,
  nothing: css`
    margin: ${theme.v1.spacing.sm};
    color: ${theme.colors.secondary.shade};
  `,
});
