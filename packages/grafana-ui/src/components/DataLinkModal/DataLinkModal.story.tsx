import React from 'react';
import { text, select } from '@storybook/addon-knobs';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { DataLinkModal } from '@grafana/ui';
import mdx from './DataLinkModal.mdx';

export default {
  title: 'Overlays/DataLinkModal',
  component: DataLinkModal,
  decorators: [withCenteredStory],
  parameters: {
    docs: {
      page: mdx,
    },
  },
};

const getKnobs = () => {
  return {
    modalTitle: text('Title', `More details`, 'Modal'),
    modalDisplayMode: select('Display Mode', ['html', 'json', 'plain_text'], 'json', 'Modal'),
    modalContent: text('Content', '{ "foo": "bar" }', 'Modal'),
  };
};

export const basic = () => {
  const { modalTitle, modalDisplayMode, modalContent } = getKnobs();
  return (
    <DataLinkModal modalTitle={modalTitle} modalDisplayMode={modalDisplayMode} modalContent={modalContent}>
      <div className="modal-header-title">
        <h3>Click here for data link modal</h3>
      </div>
    </DataLinkModal>
  );
};

const getKnobsWithoutChildren = () => {
  return {
    modalTitle: text('Modal Title', `More details about the panel goes here`, 'Modal'),
    modalDisplayMode: select('Modal Display Mode', ['html', 'json', 'plain_text'], 'html', 'Modal'),
    modalContent: text('Modal Content', 'Hello <b>world</b>', 'Modal'),
    fieldDisplayMode: select('Field Display Mode', ['plain_text', 'truncated_text', 'button'], 'plain_text', 'Display'),
    fieldTruncateLength: text('Truncate Length', '20', 'Display'),
  };
};

export const withoutChildren = () => {
  const {
    modalTitle,
    fieldDisplayMode,
    fieldTruncateLength,
    modalDisplayMode,
    modalContent,
  } = getKnobsWithoutChildren();
  return (
    <DataLinkModal
      modalTitle={modalTitle}
      fieldDisplayMode={fieldDisplayMode}
      fieldTruncateLength={fieldTruncateLength}
      modalDisplayMode={modalDisplayMode}
      modalContent={modalContent}
    ></DataLinkModal>
  );
};
