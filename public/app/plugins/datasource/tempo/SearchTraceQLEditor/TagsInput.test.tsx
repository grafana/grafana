import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { FetchError } from '@grafana/runtime';

import { TraceqlFilter, TraceqlSearchScope } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';
import { defaultTags, v2Tags } from '../traceql/autocomplete.test';
import { Tags } from '../types';

import TagsInput from './TagsInput';

describe('TagsInput', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    jest.useFakeTimers();
    // Need to use delay: null here to work with fakeTimers
    // see https://github.com/testing-library/user-event/issues/833
    user = userEvent.setup({ delay: null });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('should render correct tags', () => {
    it('for API v1 tags', async () => {
      renderTagsInput(defaultTags);

      const tag = screen.getByText('Select tag');
      expect(tag).toBeInTheDocument();
      await user.click(tag);
      jest.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(screen.getByText('foo')).toBeInTheDocument();
        expect(screen.getByText('bar')).toBeInTheDocument();
      });
    });

    it('for API v2 tags with scope of resource', async () => {
      renderTagsInput(v2Tags);

      const tag = screen.getByText('Select tag');
      expect(tag).toBeInTheDocument();
      await user.click(tag);
      jest.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(screen.getByText('cluster')).toBeInTheDocument();
        expect(screen.getByText('container')).toBeInTheDocument();
      });
    });

    it('for API v2 tags with scope of span', async () => {
      renderTagsInput(v2Tags, TraceqlSearchScope.Span);

      const tag = screen.getByText('Select tag');
      expect(tag).toBeInTheDocument();
      await user.click(tag);
      jest.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(screen.getByText('db')).toBeInTheDocument();
      });
    });

    it('for API v2 tags with scope of unscoped', async () => {
      renderTagsInput(v2Tags, TraceqlSearchScope.Unscoped);

      const tag = screen.getByText('Select tag');
      expect(tag).toBeInTheDocument();
      await user.click(tag);
      jest.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(screen.getByText('cluster')).toBeInTheDocument();
        expect(screen.getByText('container')).toBeInTheDocument();
        expect(screen.getByText('db')).toBeInTheDocument();
      });
    });
  });

  const renderTagsInput = (tags: Tags, scope: TraceqlSearchScope = TraceqlSearchScope.Resource) => {
    const datasource: TempoDatasource = {
      search: {
        filters: [],
      },
    } as unknown as TempoDatasource;

    const filter: TraceqlFilter = {
      id: 'id',
      valueType: 'string',
      scope,
    };

    render(
      <TagsInput
        datasource={datasource}
        updateFilter={jest.fn}
        deleteFilter={jest.fn}
        filters={[filter]}
        setError={function (error: FetchError): void {
          throw error;
        }}
        tags={tags || []}
        isTagsLoading={false}
      />
    );
  };
});
