import React, { useRef, useEffect, useState } from 'react';
import { SelectNG } from './SelectNG';
import { AsyncSelectNG } from './AsyncSelectNG';
import { generateOptions } from '../Select/mockOptions';
import { SelectableValue } from '@grafana/data';
import { boolean, select, number } from '@storybook/addon-knobs';
import { css } from 'emotion';
import { CONTAINER_GROUP, StoryContainer } from '../../utils/storybook/withStoryContainer';
import { Placement } from '@popperjs/core';

export default {
  title: 'Alpha/SelectNG',
  component: SelectNG,
  decorators: [],
};

interface LoadAsyncOptionsOpts {
  error?: boolean;
  noOptions?: boolean;
  timeout?: number;
  withDescriptions?: boolean;
}

const getLoadAsyncOptions = ({ timeout, error, noOptions, withDescriptions }: LoadAsyncOptionsOpts) => (
  inputValue: string | null | undefined
) => {
  return new Promise<Array<SelectableValue<string>>>((resolve, reject) => {
    setTimeout(() => {
      if (error) {
        reject(new Error('Problem loading options...'));
        return;
      }

      resolve(noOptions ? [] : generateOptions(!!withDescriptions, inputValue));
    }, timeout);
  });
};

const getCommonSelectKnobs = () => {
  const disabled = boolean('Disabled', false);
  const clearable = boolean('Clearable', true);
  const filterable = boolean('Filterable', true);
  const optionsWithDescriptions = boolean('Options with descriptions', false);
  const nestedOptions = boolean('Nested options', false);
  const placement = select<Placement>(
    'Popover placement',
    [
      'auto',
      'top',
      'bottom',
      'right',
      'left',
      'top-start',
      'top-end',
      'bottom-start',
      'bottom-end',
      'right-start',
      'right-end',
      'left-start',
      'left-end',
      'auto-start',
      'auto-end',
    ],
    'auto-start'
  );
  return { disabled, clearable, filterable, optionsWithDescriptions, nestedOptions, placement };
};

export const basic = () => {
  const [selectedOption, setSelectedOption] = useState<SelectableValue<string> | null>();
  const { optionsWithDescriptions, nestedOptions, ...otherKnobs } = getCommonSelectKnobs();
  return (
    <>
      <SelectNG
        value={selectedOption}
        onChange={v => {
          setSelectedOption(v || undefined);
        }}
        options={generateOptions(optionsWithDescriptions)}
        {...otherKnobs}
      />
    </>
  );
};

export const async = () => {
  const [_, setSelectedOption] = useState<SelectableValue<string> | null>();
  const error = boolean('Throw loading error', false);
  const noOptions = boolean('Return no options', false);
  const { optionsWithDescriptions, nestedOptions, ...otherKnobs } = getCommonSelectKnobs();

  return (
    <>
      <AsyncSelectNG
        onChange={v => {
          setSelectedOption(v || undefined);
        }}
        loadOptions={getLoadAsyncOptions({
          timeout: 2000,
          error,
          noOptions,
          withDescriptions: optionsWithDescriptions,
        })}
        {...otherKnobs}
      />
    </>
  );
};

export const positioning = () => {
  const scrollEl = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollEl.current) {
      scrollEl.current.scrollLeft = 250;
      scrollEl.current.scrollTop = 250;
    }
  }, []);
  const inputWidth = 200;
  const { optionsWithDescriptions, nestedOptions, ...otherKnobs } = getCommonSelectKnobs();

  const containerWidth = number(
    'Container width',
    500,
    {
      range: true,
      min: 100,
      max: 1000,
      step: 10,
    },
    CONTAINER_GROUP
  );
  const containerHeight = number(
    'Container height',
    500,
    {
      range: true,
      min: 100,
      max: 1000,
      step: 10,
    },
    CONTAINER_GROUP
  );
  const useAsyncSelect = boolean('Use async select', false);

  const selectEl = useAsyncSelect ? (
    <AsyncSelectNG onChange={() => {}} loadOptions={getLoadAsyncOptions({ timeout: 2000 })} {...otherKnobs} />
  ) : (
    <SelectNG options={generateOptions(optionsWithDescriptions)} onChange={() => {}} {...otherKnobs} />
  );
  return (
    <>
      <StoryContainer
        width={containerWidth}
        height={containerHeight}
        showBoundaries
        ref={scrollEl}
        className={css`
          overflow: scroll;
        `}
      >
        <div
          className={css`
            display: flex;
            flex-direction: row;
            position: relative;
            justify-content: center;
            padding-top: 500px;
            padding-bottom: 500px;
            width: 1000px;
          `}
        >
          <div
            className={css`
              width: ${inputWidth}px;
            `}
          >
            {selectEl}
          </div>
        </div>
      </StoryContainer>
    </>
  );
};
