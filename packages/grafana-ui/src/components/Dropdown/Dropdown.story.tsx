import React from 'react';
import { Dropdown } from '../Dropdown/Dropdown';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { useDropdown } from './useDropdown';
import { Button } from '../Button';

export default {
  title: 'Buttons/Dropdown',
  component: Dropdown,
  decorators: [withCenteredStory],
  parameters: {
    docs: {},
  },
};

export const Simple = () => {
  const [ref, isOpen, openDropdown, closeDropdown] = useDropdown();

  return (
    <div>
      <Button ref={ref} onClick={openDropdown} />
      <div></div>
    </div>
  );
};
