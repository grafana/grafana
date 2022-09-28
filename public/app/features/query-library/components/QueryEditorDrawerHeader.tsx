import { css, cx } from '@emotion/css';
import React, { useEffect, useRef, useState } from 'react';
import InlineSVG from 'react-inlinesvg/esm';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Button, HorizontalGroup, Icon, IconName, ModalsController, useStyles2 } from '@grafana/ui';

import { useAppNotification } from '../../../core/copy/appNotification';
import { WorkflowID } from '../../storage/types';
import { SavedQuery } from '../api/SavedQueriesApi';
import { getSavedQuerySrv } from '../api/SavedQueriesSrv';
import { implementationComingSoonAlert } from '../utils';

import { SavedQueryUpdateOpts } from './QueryEditorDrawer';
import { QueryName } from './QueryName';
import { SaveQueryWorkflowModal } from './SaveQueryWorkflowModal';

type Props = {
  onSavedQueryChange: (newQuery: SavedQuery) => void;
  savedQuery: SavedQuery;
  onDismiss: () => void;
  options: SavedQueryUpdateOpts;
};

export const QueryEditorDrawerHeader = ({ savedQuery, onDismiss, onSavedQueryChange, options }: Props) => {
  const notifyApp = useAppNotification();
  const styles = useStyles2(getStyles);

  const dropdownRef = useRef(null);

  const [queryName, setQueryName] = useState(savedQuery.title);
  const [showUseQueryOptions, setShowUseQueryOptions] = useState(false);

  const supportsPR =
    savedQuery?.storageOptions?.workflows?.some((opt) => opt.value === WorkflowID.PR) ||
    (options.type === 'create-new' && options.storage === 'git');
  const nameEditingEnabled = !Boolean(savedQuery?.uid?.length);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!dropdownRef.current?.contains(event.target)) {
        setShowUseQueryOptions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
  }, [dropdownRef]);

  const deleteQuery = async () => {
    await getSavedQuerySrv().deleteSavedQuery({ uid: savedQuery.uid });
    onDismiss();
  };

  const useQueryOptions = [
    { label: 'Add to dashboard', value: 'dashboard-panel', icon: 'apps' },
    { label: 'Create alert rule', value: 'alert-rule', icon: 'bell' },
    { label: 'View in explore', value: 'explore', icon: 'compass' },
    {
      label: 'Create recorded query',
      value: 'recorded-query',
      icon: 'record-audio',
    },
    { label: 'Create SLO', value: 'slo', icon: 'crosshair' },
    {
      label: 'Add to incident in Grafana OnCall',
      value: 'incident-oncall',
      icon: 'record-audio',
      src: 'public/app/features/query-library/img/grafana_incident.svg',
    },
    {
      label: 'Create incident in Grafana Incident',
      value: 'incident-grafana',
      icon: 'heart-break',
      src: 'public/app/features/query-library/img/grafana_oncall.svg',
    },
    {
      label: 'Create forecast in Grafana ML',
      value: 'grafana-ml',
      icon: 'grafana-ml',
      src: 'public/app/features/query-library/img/grafana_ml.svg',
    },
  ];

  const onQueryNameChange = (name: string) => {
    setQueryName(name);
    onSavedQueryChange({
      ...savedQuery,
      title: name,
    });
  };

  const onQuerySave = async (options: SavedQueryUpdateOpts) => {
    await getSavedQuerySrv()
      .updateSavedQuery(savedQuery, options)
      .then(() => notifyApp.success('Query updated'))
      .catch((err) => {
        const msg = err.data?.message || err;
        notifyApp.warning(msg);
      });
    onDismiss();
  };

  const onSaveQueryWorkflow =
    (workflow: WorkflowID) =>
    async ({ message }: { message?: string }): Promise<{ success: boolean }> => {
      try {
        await getSavedQuerySrv().updateSavedQuery(savedQuery, {
          ...options,
          workflowId: workflow,
          message,
        });
        notifyApp.success(workflow === WorkflowID.PR ? 'Pull Request created' : 'Push successful');
        onDismiss();
        return { success: true };
      } catch (e) {
        console.error(e);
        notifyApp.warning(JSON.stringify(e));
        onDismiss();
        return { success: false };
      }
    };

  return (
    <>
      <div className={styles.header}>
        <HorizontalGroup justify={'space-between'}>
          <QueryName name={queryName} onChange={onQueryNameChange} editingEnabled={nameEditingEnabled} />
          <HorizontalGroup>
            <Button icon="times" size="md" variant={'secondary'} onClick={onDismiss} autoFocus={false}>
              Close
            </Button>
            <Button
              icon={'grafana'}
              variant="secondary"
              size="md"
              onClick={() => {
                setShowUseQueryOptions(!showUseQueryOptions);
              }}
            >
              Use query
            </Button>
            <Button icon="sync" size="md" variant={'secondary'} onClick={implementationComingSoonAlert}>
              Run
            </Button>
            {/*<Button icon="share-alt" size="sm" variant={'secondary'}>Export</Button>*/}
            <Button icon="lock" size="md" variant={'secondary'} onClick={implementationComingSoonAlert} />
            {supportsPR && (
              <ModalsController>
                {({ showModal, hideModal }) => {
                  return (
                    <>
                      <Button
                        size="md"
                        variant={'primary'}
                        onClick={() => {
                          showModal(SaveQueryWorkflowModal, {
                            options: {
                              savedQuery: savedQuery,
                              workflow: WorkflowID.PR,
                            },
                            onSubmit: onSaveQueryWorkflow(WorkflowID.PR),
                            onCancel: () => {
                              hideModal();
                            },
                            onOptionsChange: () => {},
                            onSuccess: () => {},
                          });
                        }}
                      >
                        Submit PR
                      </Button>
                      &nbsp;
                      <Button
                        size="md"
                        variant={'primary'}
                        onClick={() => {
                          showModal(SaveQueryWorkflowModal, {
                            options: {
                              savedQuery: savedQuery,
                              workflow: WorkflowID.Push,
                            },
                            onSubmit: onSaveQueryWorkflow(WorkflowID.Push),
                            onCancel: () => {
                              hideModal();
                            },
                            onOptionsChange: () => {},
                            onSuccess: () => {},
                          });
                        }}
                      >
                        Push
                      </Button>
                    </>
                  );
                }}
              </ModalsController>
            )}
            {!supportsPR && (
              <>
                <Button size="md" variant={'primary'} onClick={() => onQuerySave(options)}>
                  Save
                </Button>
              </>
            )}
            <Button
              icon="trash-alt"
              size="md"
              variant={'destructive'}
              disabled={supportsPR}
              onClick={() => (supportsPR ? implementationComingSoonAlert() : deleteQuery())}
            />
          </HorizontalGroup>
        </HorizontalGroup>
        {/*@TODO Nicer submenu*/}
        <HorizontalGroup>
          {showUseQueryOptions && (
            <div
              className="panel-menu-container dropdown open"
              style={{ height: 0 }}
              ref={dropdownRef}
              onClick={() => {
                setShowUseQueryOptions(false);
              }}
            >
              <ul className={cx('dropdown-menu dropdown-menu--menu panel-menu', styles.dropdown)}>
                {useQueryOptions.map((option, key) => {
                  return (
                    <li key={key}>
                      <a onClick={implementationComingSoonAlert}>
                        <div>
                          {option.src ? (
                            <InlineSVG src={option.src} className={styles.optionSvg} />
                          ) : (
                            <Icon name={option.icon as IconName} className={styles.menuIconClassName} />
                          )}
                        </div>
                        <span className="dropdown-item-text">{option.label}</span>
                        <span className="dropdown-menu-item-shortcut" />
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </HorizontalGroup>
      </div>
    </>
  );
};

export const getStyles = (theme: GrafanaTheme2) => {
  return {
    cascaderButton: css`
      height: 24px;
    `,
    header: css`
      padding-top: 5px;
      padding-bottom: 15px;
    `,
    menuIconClassName: css`
      margin-right: ${theme.v1.spacing.sm};
      a::after {
        display: none;
      }
    `,
    optionSvg: css`
      margin-right: 8px;
      width: 16px;
      height: 16px;
    `,
    dropdown: css`
      left: 609px;
      top: 2px;
    `,
  };
};
