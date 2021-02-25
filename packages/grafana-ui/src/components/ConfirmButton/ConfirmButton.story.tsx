import React from 'react';
import { Story } from '@storybook/react';
import { ConfirmButton } from '@grafana/ui';
import { withCenteredStory } from '../../utils/storybook/withCenteredStory';
import { NOOP_CONTROL } from '../../utils/storybook/noopControl';
import { action } from '@storybook/addon-actions';
import { Button } from '../Button';
import { DeleteButton } from './DeleteButton';
import { Props } from './ConfirmButton';
import mdx from './ConfirmButton.mdx';

export default {
  title: 'Buttons/ConfirmButton',
  component: ConfirmButton,
  decorators: [withCenteredStory],
  subcomponents: { DeleteButton },
  parameters: {
    docs: {
      page: mdx,
    },
    knobs: {
      disable: true,
    },
  },
  args: {
    buttonText: 'Edit',
    confirmText: 'Save',
    size: 'md',
    confirmVariant: 'primary',
    disabled: false,
    closeOnConfirm: true,
  },
  argTypes: {
    confirmVariant: { control: { type: 'select', options: ['primary', 'secondary', 'destructive', 'link'] } },
    size: { control: { type: 'select', options: ['sm', 'md', 'lg'] } },
    className: NOOP_CONTROL,
  },
};

interface StoryProps extends Partial<Props> {
  buttonText: string;
}

export const Basic: Story<StoryProps> = (args) => {
  return (
    <>
      <div className="gf-form-group">
        <div className="gf-form">
          <ConfirmButton
            closeOnConfirm={args.closeOnConfirm}
            size={args.size}
            confirmText={args.confirmText}
            disabled={args.disabled}
            confirmVariant={args.confirmVariant}
            onConfirm={() => {
              action('Saved')('save!');
            }}
          >
            {args.buttonText}
          </ConfirmButton>
        </div>
      </div>
    </>
  );
};

export const withCustomButton: Story<StoryProps> = (args) => {
  return (
    <>
      <div className="gf-form-group">
        <div className="gf-form">
          <ConfirmButton
            closeOnConfirm={args.closeOnConfirm}
            size={args.size}
            confirmText={args.confirmText}
            disabled={args.disabled}
            confirmVariant={args.confirmVariant}
            onConfirm={() => {
              action('Saved')('save!');
            }}
          >
            <Button size={args.size} variant="secondary" icon="pen">
              {args.buttonText}
            </Button>
          </ConfirmButton>
        </div>
      </div>
    </>
  );
};

export const deleteButton: Story<StoryProps> = (args) => {
  return (
    <>
      <div className="gf-form-group">
        <div className="gf-form">
          <DeleteButton
            size={args.size}
            disabled={args.disabled}
            onConfirm={() => {
              action('Deleted')('delete!');
            }}
          />
        </div>
      </div>
    </>
  );
};
