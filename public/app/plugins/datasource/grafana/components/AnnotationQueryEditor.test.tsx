import React from 'react';
import { render, screen } from '@testing-library/react';

import { GrafanaAnnotationQuery, GrafanaAnnotationType, GrafanaQueryType } from '../types';
import AnnotationQueryEditor from './AnnotationQueryEditor';

describe('AnnotationQueryEditor', () => {
  const mockOnChange = jest.fn();
  let mockQuery: GrafanaAnnotationQuery;

  beforeEach(() => {
    mockQuery = {
      queryType: GrafanaQueryType.Annotations,
      refId: 'Anno',
      type: GrafanaAnnotationType.Tags,
      limit: 100,
    };
  });

  it('has a "Filter by" input', () => {
    render(<AnnotationQueryEditor query={mockQuery} onChange={mockOnChange} />);
    const filterBy = screen.getByLabelText('Filter by');
    expect(filterBy).toBeInTheDocument();
  });

  it('has a "Max limit" input', () => {
    render(<AnnotationQueryEditor query={mockQuery} onChange={mockOnChange} />);
    const maxLimit = screen.getByLabelText('Max limit');
    expect(maxLimit).toBeInTheDocument();
  });

  describe('when the query type is "Tags" and the tags array is present', () => {
    beforeEach(() => {
      mockQuery.tags = [];
    });

    it('has a "Match any" toggle', () => {
      render(<AnnotationQueryEditor query={mockQuery} onChange={mockOnChange} />);
      const matchAny = screen.getByLabelText(/Match any/);
      expect(matchAny).toBeInTheDocument();
    });

    it('has a "Tags" input', () => {
      render(<AnnotationQueryEditor query={mockQuery} onChange={mockOnChange} />);
      const tags = screen.getByLabelText(/Tags/);
      expect(tags).toBeInTheDocument();
    });
  });

  describe('when the query type is "Dashboard"', () => {
    beforeEach(() => {
      mockQuery.type = GrafanaAnnotationType.Dashboard;
    });

    it('does not have a "Match any" toggle', () => {
      render(<AnnotationQueryEditor query={mockQuery} onChange={mockOnChange} />);
      const matchAny = screen.queryByLabelText('Match any');
      expect(matchAny).toBeNull();
    });

    it('does not have a "Tags" input', () => {
      render(<AnnotationQueryEditor query={mockQuery} onChange={mockOnChange} />);
      const tags = screen.queryByLabelText('Tags');
      expect(tags).toBeNull();
    });
  });
});
