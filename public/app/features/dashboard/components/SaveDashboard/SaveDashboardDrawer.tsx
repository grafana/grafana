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
  Spinner,
  Tab,
  TabContent,
  TabsBar,
  TextArea,
  useStyles2,
  VerticalGroup,
} from '@grafana/ui';
import { useForm, useWatch } from 'react-hook-form';
import { SaveDashboardErrorProxy } from './SaveDashboardErrorProxy';
import { SaveDashboardModalProps } from './types';
import { GrafanaTheme2 } from '@grafana/data';
import { DiffViewer } from '../VersionHistory/DiffViewer';
import { jsonDiff } from '../VersionHistory/utils';
import { DiffGroup } from '../VersionHistory/DiffGroup';
import { selectors } from '@grafana/e2e-selectors';
import { useAsync } from 'react-use';
import { backendSrv } from 'app/core/services/backend_srv';
import { getBackendSrv } from '@grafana/runtime';
import { RootStorageMeta } from 'app/features/storage/types';
import { getIconName } from 'app/features/storage/StorageList';

interface FormDTO {
  action?: string; //
  title?: string;
  message?: string;

  dashboardTitle?: string;
  targetFolder?: string;

  saveTimerange?: boolean;
  saveVariables?: boolean;
}

const selectOptions = [
  {
    label: 'Push to main',
    value: 'save',
  },
  {
    label: 'Submit pull request',
    value: 'pr',
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
  } = useForm<FormDTO>({ defaultValues: { action: 'save' } });
  const hasTimeChanged = useMemo(() => dashboard.hasTimeChanged(), [dashboard]);
  const hasVariableChanged = useMemo(() => dashboard.hasVariableValuesChanged(), [dashboard]);
  const currentValue = useWatch({ control });

  const isNew = useMemo(() => {
    return dashboard.version === 0 && !dashboard.uid;
  }, [dashboard]);

  const storage = useAsync(async () => {
    const uid = dashboard.uid ?? '';
    const idx = uid.indexOf('/');
    if (idx < 1) {
      return {
        isGit: false,
        isDirect: false,
      };
    }

    const key = dashboard.uid.substring(0, idx);
    const status = (await getBackendSrv().get(`api/storage/root/${key}`)) as RootStorageMeta;

    return {
      isGit: status.config.type === 'git',
      isDirect: status.config.type === 'disk',
      status,
    };
  }, [dashboard]);

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
    if (!previous.value) {
      return {};
    }

    console.log('UPDATING data', previous.value);

    const clone = dashboard.getSaveModelClone({
      saveTimerange: Boolean(currentValue.saveTimerange),
      saveVariables: Boolean(currentValue.saveVariables),
    });
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
  }, [dashboard, previous.value, currentValue.saveTimerange, currentValue.saveVariables]);

  const [showDiff, setShowDiff] = useState(false);

  const [error, _setError] = useState<Error>();
  const [rsp, setRsp] = useState<WriteValueResponse>();
  const [saving, setSaving] = useState(false);

  const doSave = async (dto: FormDTO) => {
    setSaving(true);
    const rsp = (await backendSrv.post(`/api/dashboards/path/${dashboard.uid}`, {
      body: data.clone,
      message: dto.message ?? '',
      title: dto.title,
      action: dto.action,
    })) as WriteValueResponse;

    // It is OK
    if (rsp.code === 200 && !rsp.pending) {
      onDismiss();
    }

    console.log('Results', rsp);
    setSaving(false);
    setRsp(rsp);
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
      return <div>TODO: path picker...</div>;
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
    return <div>???</div>;
  };

  return (
    <>
      {error && (
        <SaveDashboardErrorProxy
          error={error}
          dashboard={dashboard}
          dashboardSaveModel={dashboard} // or clone?
          onDismiss={onDismiss}
        />
      )}
      {!error && (
        <Drawer
          title={dashboard.title}
          onClose={onDismiss}
          width={'40%'}
          subtitle={
            <TabsBar className={styles.tabsBar}>
              <Tab label={'Save'} active={!showDiff} onChangeTab={() => setShowDiff(false)} />
              {data.hasChanges && (
                <Tab
                  label={'Changes'}
                  active={showDiff}
                  onChangeTab={() => setShowDiff(true)}
                  counter={data.diffCount}
                />
              )}
            </TabsBar>
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
                <div>
                  <form onSubmit={handleSubmit(doSave)}>
                    <>
                      {hasTimeChanged && (
                        <Checkbox
                          {...register('saveTimerange')}
                          label="Save current time range as dashboard default"
                          aria-label={selectors.pages.SaveDashboardModal.saveTimerange}
                        />
                      )}
                      {hasVariableChanged && (
                        <Checkbox
                          {...register('saveVariables')}
                          label="Save current variable values as dashboard default"
                          aria-label={selectors.pages.SaveDashboardModal.saveVariables}
                        />
                      )}
                      {(hasVariableChanged || hasTimeChanged) && <div className="gf-form-group" />}

                      <Field label="Location">{renderLocationInfo()}</Field>

                      {storage.value?.isGit && (
                        <Field label="Workflow">
                          <InputControl
                            name="action"
                            control={control}
                            render={({ field }) => <RadioButtonGroup {...field} options={selectOptions} />}
                          />
                        </Field>
                      )}

                      {currentValue.action === 'pr' && (
                        <>
                          <Field label="Title" invalid={!!errors.title} error="Title is required">
                            <Input
                              {...register('title', { required: isGit })}
                              placeholder="Set title on pull request"
                            />
                          </Field>
                        </>
                      )}

                      {!isDirect && (
                        <Field label="Changelog" invalid={!!errors.message} error="Changelog is required">
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
                          disabled={!data.hasChanges}
                          icon={saving ? 'fa fa-spinner' : undefined}
                        >
                          {saving ? '' : getActionName()}
                        </Button>
                        <Button type="button" variant="secondary" onClick={onDismiss} fill="outline">
                          Cancel
                        </Button>
                      </HorizontalGroup>
                      {!data.hasChanges && <div className={styles.nothing}>No changes to save</div>}
                    </>
                  </form>
                </div>
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
      )}
    </>
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
