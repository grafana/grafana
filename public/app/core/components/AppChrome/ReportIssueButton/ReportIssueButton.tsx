import { useState } from 'react';

import { Menu, Dropdown, ToolbarButton } from '@grafana/ui';

import { Spec } from '../../../../../../apps/feedback/plugin/src/feedback/v0alpha1/types.spec.gen';
import { getFeedbackAPI } from '../../../../features/feedback/api';

export interface Props {}

export const ReportIssueButton = ({}: Props) => {
  const [isOpen, setIsOpen] = useState(false);

  const MenuActions = () => {
    const onClick = (e: { preventDefault: () => void }) => {
      e.preventDefault();
      console.log('hi', e);
      const feedback: Spec = {
        message: 'test sarah test',
      };
      const feedbackApi = getFeedbackAPI();
      feedbackApi.createFeedback(feedback);
    };
    return (
      <Menu>
        <p>Report an issue</p>
        <input placeholder="so what happened?"></input>
        <button onClick={onClick}>submit</button>
      </Menu>
    );
  };
  return (
    <>
      <Dropdown overlay={MenuActions} placement="bottom-end" onVisibleChange={setIsOpen}>
        <ToolbarButton iconOnly icon={'bug'} isOpen={isOpen} aria-label="New" />
      </Dropdown>
    </>
  );
};
