import React, { useState, useRef, useEffect } from 'react';
import { Modal, TabContent, TabsBar, Tab, Button, Alert, useStyles } from '@grafana/ui';
import { Rule, Setting, SettingLabel, PipelineListOption, EntitiesTypes } from './types';
import { getBackendSrv } from '@grafana/runtime';
import { css } from '@emotion/css';
import { GrafanaTheme, SelectableValue } from '@grafana/data';
import SettingsEditor from './SettingsEditor';
interface Props {
  rule: Rule;
  isOpen: boolean;
  onClose: () => void;
  clickColumn: Setting;
}
interface TabType {
  label: SettingLabel;
  value: Setting;
}
const tabs: TabType[] = [
  { label: 'Converter', value: 'converter' },
  { label: 'Processor', value: 'processor' },
  { label: 'Output', value: 'output' },
];

export const RuleModal: React.FC<Props> = (props) => {
  const { rule, isOpen, onClose, clickColumn } = props;
  // TODO: use reducer
  const [activeTab, setActiveTab] = useState<Setting>(clickColumn);
  const [success, setSuccess] = useState<boolean>();
  const [error, setError] = useState<boolean>();
  const [editedBody, setEditedBody] = useState<object | undefined>();
  const [pipelineEntitiesList, setPipelineEntitiesList] = useState<any>();
  const [pipelineEntitiesTypes, setPipelineEntitiesTypes] = useState<any>();
  const [hasChange, setChange] = useState<boolean>(false);
  const [currSetting, setCurrSetting] = useState<string>(clickColumn);
  const [currSettingType, setCurrSettingType] = useState<string>('jsonAuto');
  const isMounted = useRef(false);
  const styles = useStyles(getStyles);

  const onBlur = (text: string, setting: string, type: string) => {
    setEditedBody(text ? JSON.parse(text) : undefined);
    setChange(true);
    setCurrSetting(setting);
    setCurrSettingType(type);
  };
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  useEffect(() => {
    getBackendSrv()
      .get(`api/live/pipeline-entities`)
      .then((data: EntitiesTypes) => {
        if (isMounted) {
          let options = {
            converters: [] as SelectableValue[],
            processors: [] as SelectableValue[],
            outputs: [] as SelectableValue[],
          };
          let key: keyof typeof data;
          for (key in data) {
            options[key] = data[key].map((typeObj: PipelineListOption) => ({
              label: typeObj.type,
              value: typeObj.type,
            }));
          }
          setPipelineEntitiesTypes(options);
          setPipelineEntitiesList(data);
        }
      })
      .catch((e) => {
        console.error(e);
      });
  }, []);
  console.log(pipelineEntitiesList);
  // make the success banner disappear in 2 secs
  useEffect(() => {
    if (success === null || isMounted.current === false) {
      return;
    }

    const timerId = setTimeout(() => {
      setSuccess(undefined);
    }, 2000);

    return () => {
      clearTimeout(timerId);
    };
  }, [success, setSuccess]);

  // make the error banner disappear in 2 secs
  useEffect(() => {
    if (error === null || isMounted.current === false) {
      return;
    }

    const timerId = setTimeout(() => {
      setError(undefined);
    }, 2000);

    return () => {
      clearTimeout(timerId);
    };
  }, [error, setError]);

  const onSave = () => {
    const newRule = {
      pattern: rule.pattern,
      settings: {
        ...rule.settings,
        [currSetting]: {
          type: currSettingType,
          [currSettingType]: editedBody,
        },
      },
    };
    getBackendSrv()
      .put(`api/live/channel-rules`, newRule)
      .then((data) => {
        if (isMounted) {
          setSuccess(true);
        }
      })
      .catch(() => setError(true));
  };

  const onRemoveSuccessAlert = () => setSuccess(false);
  const onRemoveErrorAlert = () => setError(false);

  return (
    <Modal isOpen={isOpen} title={rule.pattern} onDismiss={onClose} closeOnEscape>
      <TabsBar>
        {tabs.map((tab, index) => {
          return (
            <Tab
              key={index}
              label={tab.label}
              active={tab.value === activeTab}
              onChangeTab={() => {
                setActiveTab(tab.value);
              }}
            />
          );
        })}
      </TabsBar>
      <TabContent>
        {success && <Alert title="Saved successfully" severity="success" onRemove={onRemoveSuccessAlert} />}
        {error && <Alert title="Failed to save" severity="error" onRemove={onRemoveErrorAlert} />}
        <SettingsEditor
          {...props}
          onBlur={onBlur}
          types={pipelineEntitiesTypes?.[`${activeTab}s`]}
          setting={activeTab}
          pipelineEntitiesList={pipelineEntitiesList?.[`${activeTab}s`]}
        />
        <Button onClick={onSave} className={styles.save} disabled={hasChange ? false : true}>
          Save
        </Button>
      </TabContent>
    </Modal>
  );
};

const getStyles = (theme: GrafanaTheme) => {
  return {
    save: css`
      margin-top: 5px;
    `,
  };
};
