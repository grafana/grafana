import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { Props, QueryModal, addQueryModal } from './QueryModal';
import { QueryModalBodyProps, QueryModalModel } from './types';

describe('QueryModal', () => {
  it('displays the query modal', async () => {
    const createRecordedQuery: React.FC<QueryModalBodyProps> = ({}) => {
      return <div>Hello world</div>;
    };
    const createRecordedQueryModal: QueryModalModel = {
      title: 'Create Recorded Query',
      body: createRecordedQuery,
    };
    addQueryModal('modalKey', createRecordedQueryModal);
    const props: Props = {
      isOpen: true,
      modalKey: 'modalKey',
      onDismiss: () => {},
    };
    render(<QueryModal {...props} />);

    await waitFor(() => {
      expect(screen.getByText('Hello world')).toBeVisible();
    });
  });
});
