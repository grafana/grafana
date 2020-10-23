import React, { FunctionComponent } from 'react';
import { SettingsEditorContainer } from '../../SettingsEditorContainer';
import { BucketAggregation } from '../state/types';

interface Props {
  bucketAgg: BucketAggregation;
}

export const SettingsEditor: FunctionComponent<Props> = ({ bucketAgg }) => {
  return <SettingsEditorContainer label="Settings">Settings</SettingsEditorContainer>;
};
