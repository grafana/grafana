import { render, waitFor, screen } from '@testing-library/react';

import { AnnoKeyCreatedBy } from '../../apiserver/types';
import { ListQueryTemplateApiResponse } from '../../query-library/api/endpoints.gen';

import { QueryTemplatesList } from './QueryTemplatesList';
import { QueryActionButtonProps } from './types';

let data: ListQueryTemplateApiResponse = {
  items: [],
};

jest.mock('app/features/query-library', () => {
  const actual = jest.requireActual('app/features/query-library');
  return {
    ...actual,
    useDeleteQueryTemplateMutation: () => [() => {}],
    useListQueryTemplateQuery: () => {
      return {
        data: data,
        isLoading: false,
        error: null,
      };
    },
  };
});

jest.mock('./utils/dataFetching', () => {
  return {
    __esModule: true,
    useLoadQueryMetadata: () => {
      return {
        loading: false,
        value: [
          {
            index: '0',
            uid: '0',
            datasourceName: 'prometheus',
            datasourceRef: { type: 'prometheus', uid: 'Prometheus0' },
            datasourceType: 'prometheus',
            createdAtTimestamp: 0,
            query: { refId: 'A' },
            queryText: 'http_requests_total{job="test"}',
            description: 'template0',
            user: {
              uid: 'viewer:JohnDoe',
              displayName: 'John Doe',
              avatarUrl: '',
            },
            error: undefined,
          },
        ],
      };
    },
    useLoadUsers: () => {
      return {
        value: {
          display: [
            {
              avatarUrl: '',
              displayName: 'john doe',
              identity: {
                name: 'JohnDoe',
                type: 'viewer',
              },
            },
          ],
        },
        loading: false,
        error: null,
      };
    },
  };
});

describe('QueryTemplatesList', () => {
  it('renders empty state', async () => {
    data = {};
    render(<QueryTemplatesList />);
    await waitFor(() => {
      expect(screen.getByText(/You haven't saved any queries to your library yet/)).toBeInTheDocument();
    });
  });

  it('renders query', async () => {
    data.items = testItems;
    render(<QueryTemplatesList />);
    await waitFor(() => {
      // We don't really show query template title for some reason so creator name
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
    });
  });

  it('renders actionButton for query', async () => {
    data.items = testItems;
    let passedProps: QueryActionButtonProps;

    const queryActionButton = (props: QueryActionButtonProps) => {
      passedProps = props;
      return <button>TEST_ACTION_BUTTON</button>;
    };

    render(<QueryTemplatesList queryActionButton={queryActionButton} />);
    await waitFor(() => {
      // We don't really show query template title for some reason so creator name
      expect(screen.getByText(/John Doe/)).toBeInTheDocument();
      expect(screen.getByText(/TEST_ACTION_BUTTON/)).toBeInTheDocument();
      // We didn't put much else into the query object but should be enough to check the prop
      expect(passedProps.queries).toMatchObject([{ refId: 'A' }]);
    });
  });
});

const testItems = [
  {
    metadata: {
      name: 'TEST_QUERY',
      creationTimestamp: '2025-01-01T11:11:11.00Z',
      annotations: {
        [AnnoKeyCreatedBy]: 'viewer:JohnDoe',
      },
    },
    spec: {
      title: 'Test Query title',
      targets: [
        {
          variables: {},
          properties: {
            refId: 'A',
            datasource: {
              uid: 'Prometheus',
              type: 'prometheus',
            },
          },
        },
      ],
    },
  },
];
