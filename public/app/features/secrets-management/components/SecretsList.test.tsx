import { render, screen, userEvent } from 'test/test-utils';

import { secretsList } from '../__mocks__/secretsList';
import { Secret } from '../types';

import { SecretsList } from './SecretsList';

// Per item tests har handled by SecretItem test suite
jest.mock('./SecretItem', () => ({
  SecretItem: ({ secret }: { secret: Secret }) => {
    return <div>{secret.name}</div>;
  },
}));

const handleEditSecret = jest.fn();
const handleDeleteSecret = jest.fn();
const handleCreateSecret = jest.fn();

function getProps(secrets: Secret[] = [], filter?: string) {
  return {
    secrets,
    filter,
    onEditSecret: handleEditSecret,
    onDeleteSecret: handleDeleteSecret,
    onCreateSecret: handleCreateSecret,
  };
}

afterEach(() => {
  jest.clearAllMocks();
});

describe('SecretsList', () => {
  it('should show empty state with create button', async () => {
    const props = getProps();
    render(<SecretsList {...props} />);
    expect(screen.getByText(/you don't have any secrets yet/i)).toBeInTheDocument();
    const createButton = screen.getByText(/create secret/i, {
      selector: 'button > span',
    });
    expect(createButton).toBeInTheDocument();
    await userEvent.click(createButton);
    expect(handleCreateSecret).toHaveBeenCalledTimes(1);
  });

  it('should render all secrets', () => {
    const props = getProps(secretsList);
    render(<SecretsList {...props} />);

    secretsList.forEach((secret) => {
      expect(screen.getByText(secret.name)).toBeInTheDocument();
    });
  });

  it('should show search empty state when filter is in use without matching result', () => {
    const props = getProps(secretsList, '!?IDONTEXIST!?');
    render(<SecretsList {...props} />);
    expect(screen.getByText(/no secrets found/i)).toBeInTheDocument();
  });

  it('should only show search results matching filter', () => {
    const filter = secretsList[0].name;
    const props = getProps(secretsList, filter);
    render(<SecretsList {...props} />);

    secretsList.forEach((secret) => {
      if (secret.name.includes(filter)) {
        expect(screen.queryByText(secret.name)).toBeInTheDocument();
      } else {
        expect(screen.queryByText(secret.name)).not.toBeInTheDocument();
      }
    });
  });
});
