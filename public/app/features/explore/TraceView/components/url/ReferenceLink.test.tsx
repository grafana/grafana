// Copyright (c) 2019 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { render, screen } from '@testing-library/react';
import React from 'react';

import { LinkModel } from '@grafana/data';

import { TraceSpanReference } from '../types/trace';

import ReferenceLink from './ReferenceLink';

describe(ReferenceLink, () => {
  const createFocusSpanLinkMock = jest.fn((traceId, spanId) => {
    const model: LinkModel = {
      href: `${traceId}-${spanId}`,
      title: 'link',
      origin: 'origin',
      target: '_blank',
    };
    return model;
  });

  const ref: TraceSpanReference = {
    refType: 'FOLLOWS_FROM',
    traceID: 'trace1',
    spanID: 'span1',
  };

  describe('rendering', () => {
    it('renders reference with correct href', async () => {
      render(
        <ReferenceLink reference={ref} createFocusSpanLink={createFocusSpanLinkMock}>
          link
        </ReferenceLink>
      );

      const link = await screen.findByText('link');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', 'trace1-span1');
    });
  });
});
