import { type Meta, type StoryFn } from '@storybook/react';
import { useLayoutEffect, useRef, useState } from 'react';
import { action } from 'storybook/actions';

import { Button } from '../Button/Button';
import { Stack } from '../Layout/Stack/Stack';

import { Tag } from './Tag';
import mdx from './Tag.mdx';

const meta: Meta<typeof Tag> = {
  title: 'Information/Tag',
  component: Tag,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: ['onClick', 'onRemove'],
    },
  },
  args: {
    name: 'Tag',
    colorIndex: 0,
  },
};

export const Single: StoryFn<typeof Tag> = (args) => {
  return <Tag name={args.name} colorIndex={args.colorIndex} onClick={action('Tag clicked')} icon={args.icon} />;
};

const initialTags = ['Production', 'Europe', 'Frontend'];

export const Removable: StoryFn<typeof Tag> = () => {
  const [tags, setTags] = useState(initialTags);
  const listRef = useRef<HTMLDivElement>(null);
  const resetRef = useRef<HTMLButtonElement>(null);
  const focusIndex = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (focusIndex.current === null) {
      return;
    }

    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [];
    const nextButton = buttons[Math.min(focusIndex.current, buttons.length - 1)];
    (nextButton ?? resetRef.current)?.focus();
    focusIndex.current = null;
  }, [tags]);

  const removeTag = (name: string) => {
    focusIndex.current = tags.indexOf(name);
    setTags(tags.filter((tag) => tag !== name));
  };

  return (
    <Stack direction="column" alignItems="flex-start">
      <Stack ref={listRef} wrap="wrap">
        {tags.map((name) => (
          <Tag key={name} name={name} onRemove={removeTag} />
        ))}
      </Stack>
      <Button ref={resetRef} variant="secondary" onClick={() => setTags(initialTags)}>
        Reset tags
      </Button>
    </Stack>
  );
};

export const LabelAndRemove: StoryFn<typeof Tag> = (args) => (
  <Tag {...args} onClick={action('Tag label clicked')} onRemove={action('Tag removed')} />
);

export const Disabled: StoryFn<typeof Tag> = (args) => (
  <Tag {...args} disabled onClick={action('Tag label clicked')} onRemove={action('Tag removed')} />
);

export const WithIcon: StoryFn<typeof Tag> = (args) => (
  <Tag {...args} icon="tag-alt" onRemove={action('Tag removed')} />
);

export const States: StoryFn<typeof Tag> = () => (
  <Stack direction="column" alignItems="flex-start">
    <Stack wrap="wrap" alignItems="center">
      <Tag name="Static" />
      <Tag name="Clickable" onClick={action('Tag label clicked')} />
      <Tag name="Removable" onRemove={action('Tag removed')} />
      <Tag name="Both actions" onClick={action('Tag label clicked')} onRemove={action('Tag removed')} />
      <Tag name="With icon" icon="tag-alt" onRemove={action('Tag removed')} />
    </Stack>
    <Stack wrap="wrap" alignItems="center">
      <Tag name="Disabled label" disabled onClick={action('Tag label clicked')} />
      <Tag name="Disabled removal" disabled onRemove={action('Tag removed')} />
      <Tag name="Disabled actions" disabled onClick={action('Tag label clicked')} onRemove={action('Tag removed')} />
    </Stack>
  </Stack>
);

export default meta;
