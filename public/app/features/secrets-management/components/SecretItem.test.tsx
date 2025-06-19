import { render, screen, userEvent } from 'test/test-utils';

import { secretsList } from '../__mocks__/secretsList';
import { DECRYPT_ALLOW_LIST_LABEL_MAP } from '../constants';

import { SecretItem } from './SecretItem';

const handleOnEditSecret = jest.fn();
const handleOnDeleteSecret = jest.fn();

afterEach(() => {
  jest.clearAllMocks();
});

function getProps(secretListIndex = 0) {
  return {
    secret: secretsList[secretListIndex],
    onEditSecret: handleOnEditSecret,
    onDeleteSecret: handleOnDeleteSecret,
  };
}

describe('SecretItem', () => {
  it('should show secret name', () => {
    const props = getProps();
    render(<SecretItem {...props} />);
    expect(screen.getByText(props.secret.name)).toBeInTheDocument();
  });

  it('should show secret uid', () => {
    const props = getProps();
    render(<SecretItem {...props} />);
    expect(screen.getByText('ID:')).toBeInTheDocument();
    expect(screen.getByText(props.secret.uid)).toBeInTheDocument();
  });

  it('should show secret description', () => {
    const props = getProps();
    render(<SecretItem {...props} />);
    expect(screen.getByText('Description:')).toBeInTheDocument();
    expect(screen.getByText(props.secret.description)).toBeInTheDocument();
  });

  it('should show secret created at', () => {
    const props = getProps();
    render(<SecretItem {...props} />);
    expect(screen.getByText('Created:')).toBeInTheDocument();
    expect(screen.getByText(props.secret.created)).toBeInTheDocument(); // raw value when running test
  });

  it('should show all secret decrypters', () => {
    const props = getProps(1);
    render(<SecretItem {...props} />);
    expect(screen.getByText('Decrypters:')).toBeInTheDocument();
    expect(props.secret.decrypters!.length).toBe(2);
    props.secret.decrypters!.forEach((decrypter) => {
      expect(
        screen.getByText(DECRYPT_ALLOW_LIST_LABEL_MAP[decrypter as keyof typeof DECRYPT_ALLOW_LIST_LABEL_MAP])
      ).toBeInTheDocument();
    });
  });
  it('should not show keeper if it doesnt exist', () => {
    const props = getProps();
    render(<SecretItem {...props} />);
    expect(screen.queryByText('Keeper:')).not.toBeInTheDocument();
  });

  it('should show keeper if it exists', () => {
    const props = getProps(1);
    render(<SecretItem {...props} />);
    expect(screen.queryByText('Keeper:')).toBeInTheDocument();
    expect(screen.queryByText(props.secret.keeper as string)).toBeInTheDocument();
  });

  it('should have an edit button', async () => {
    const props = getProps();
    render(<SecretItem {...props} />);

    const editButton = screen.getByText('Edit');
    expect(editButton).toBeInTheDocument();
    await userEvent.click(editButton);
    expect(handleOnEditSecret).toHaveBeenCalledTimes(1);

    // a11y
    const editButtonByAriaLabel = screen.getByLabelText(`Edit ${props.secret.name}`);
    expect(editButtonByAriaLabel).toBeInTheDocument();
    await userEvent.click(editButtonByAriaLabel);
    expect(handleOnEditSecret).toHaveBeenCalledTimes(2);
  });

  it('should have a delete button with confirmation', async () => {
    const props = getProps();
    render(<SecretItem {...props} />);

    const deleteButton = screen.getByLabelText(`Delete ${props.secret.name}`, { selector: 'button' });
    expect(deleteButton).toBeInTheDocument();

    await userEvent.click(deleteButton);
    expect(await screen.findByText(/Are you sure you want to delete/i));
    await userEvent.type(screen.getByPlaceholderText('Type "delete" to confirm'), 'delete');

    await userEvent.click(screen.getByText('Delete'));
    expect(handleOnDeleteSecret).toHaveBeenCalledTimes(1);
  });
});
