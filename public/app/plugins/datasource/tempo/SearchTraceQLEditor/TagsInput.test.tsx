import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { FetchError } from '@grafana/runtime';

import { TraceqlFilter, TraceqlSearchScope } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';
import TempoLanguageProvider from '../language_provider';
import { Scope } from '../types';

import TagsInput from './TagsInput';
import { v1Tags, v2Tags } from './utils.test';

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
      renderTagsInput(v1Tags);

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
      renderTagsInput(undefined, v2Tags, TraceqlSearchScope.Resource);

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
      renderTagsInput(undefined, v2Tags, TraceqlSearchScope.Span);

      const tag = screen.getByText('Select tag');
      expect(tag).toBeInTheDocument();
      await user.click(tag);
      jest.advanceTimersByTime(1000);
      await waitFor(() => {
        expect(screen.getByText('db')).toBeInTheDocument();
      });
    });

    it('for API v2 tags with scope of unscoped', async () => {
      renderTagsInput(undefined, v2Tags, TraceqlSearchScope.Unscoped);

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

  const renderTagsInput = (tagsV1?: string[], tagsV2?: Scope[], scope?: TraceqlSearchScope) => {
    const datasource: TempoDatasource = {
      search: {
        filters: [],
      },
    } as unknown as TempoDatasource;

    const lp = new TempoLanguageProvider(datasource);
    if (tagsV1) {
      lp.setV1Tags(tagsV1);
    } else if (tagsV2) {
      lp.setV2Tags(tagsV2);
    }
    datasource.languageProvider = lp;

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
        staticTags={[]}
        isTagsLoading={false}
      />
    );
  };
});
