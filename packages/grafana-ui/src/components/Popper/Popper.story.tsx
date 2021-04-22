import React, { useState } from 'react';
import { Popper } from '../Popper/Popper';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { Button } from '../Button';
import { ClickOutsideWrapper } from '../ClickOutsideWrapper/ClickOutsideWrapper';

export default {
  title: 'Buttons/Popper',
  component: Popper,
  decorators: [withCenteredStory],
  parameters: {
    docs: {},
  },
};

export const Example = () => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <ClickOutsideWrapper onClick={() => setIsOpen(false)}>
      <Button ref={setAnchorEl} onClick={() => setIsOpen(!isOpen)}>
        Button
      </Button>
      {isOpen && (
        <Popper anchorEl={anchorEl}>
          <div style={{ background: 'red', width: '100px', height: '200px' }} />
        </Popper>
      )}
    </ClickOutsideWrapper>
  );
};
