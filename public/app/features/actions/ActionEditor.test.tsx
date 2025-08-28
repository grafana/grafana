import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {
  Action,
  ActionType,
  defaultActionConfig,
  VariableSuggestion,
  VariableOrigin,
  HttpRequestMethod,
  SupportedDataSourceTypes,
} from '@grafana/data';

import { ActionEditor } from './ActionEditor';

describe('ActionEditor', () => {
  const mockOnChange = jest.fn();

  const mockSuggestions: VariableSuggestion[] = [
    { value: '${var1}', label: 'Variable 1', origin: VariableOrigin.BuiltIn },
    { value: '${var2}', label: 'Variable 2', origin: VariableOrigin.BuiltIn },
  ];

  const defaultAction: Action = {
    ...defaultActionConfig,
    title: 'Test Action',
    type: ActionType.Fetch,
    [ActionType.Fetch]: {
      method: HttpRequestMethod.POST,
      url: 'https://api.example.com',
      body: '{}',
      queryParams: [],
      headers: [['Content-Type', 'application/json']],
    },
  };

  const defaultProps = {
    index: 0,
    value: defaultAction,
    onChange: mockOnChange,
    suggestions: mockSuggestions,
    showOneClick: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders action editor with basic fields', () => {
    render(<ActionEditor {...defaultProps} />);

    expect(screen.getByDisplayValue('Test Action')).toBeInTheDocument();
    expect(screen.getByDisplayValue('https://api.example.com')).toBeInTheDocument();
    expect(screen.getByText('Connection')).toBeInTheDocument();
    expect(screen.getByText('Variables')).toBeInTheDocument();
    expect(screen.getByText('Query parameters')).toBeInTheDocument();
    expect(screen.getByText('Headers')).toBeInTheDocument();
  });

  it('toggles one click setting', async () => {
    const user = userEvent.setup();
    render(<ActionEditor {...defaultProps} />);

    const oneClickSwitch = screen.getByRole('switch');
    await user.click(oneClickSwitch);

    expect(mockOnChange).toHaveBeenCalledWith(0, {
      ...defaultAction,
      oneClick: !defaultAction.oneClick,
    });
  });

  it('updates HTTP method', async () => {
    const user = userEvent.setup();
    render(<ActionEditor {...defaultProps} />);

    const getMethodButton = screen.getByRole('radio', { name: 'GET' });
    await user.click(getMethodButton);

    expect(mockOnChange).toHaveBeenCalledWith(0, {
      ...defaultAction,
      [ActionType.Fetch]: {
        ...defaultAction[ActionType.Fetch],
        method: HttpRequestMethod.GET,
      },
    });
  });

  it('renders color picker for background color', () => {
    render(<ActionEditor {...defaultProps} />);

    expect(screen.getByText('Button style')).toBeInTheDocument();
    expect(screen.getByText('Color')).toBeInTheDocument();
  });

  it('hides body field for GET requests', () => {
    const getAction: Action = {
      ...defaultAction,
      [ActionType.Fetch]: {
        ...defaultAction[ActionType.Fetch]!,
        method: HttpRequestMethod.GET,
      },
    };

    render(<ActionEditor {...defaultProps} value={getAction} />);

    expect(screen.queryByDisplayValue('{}')).not.toBeInTheDocument();
  });

  describe('Connection functionality', () => {
    it('renders connection picker section', () => {
      render(<ActionEditor {...defaultProps} />);

      expect(screen.getByText('Connection')).toBeInTheDocument();
    });

    it('renders connection picker for Infinity action type', () => {
      const proxyAction: Action = {
        ...defaultAction,
        type: ActionType.Infinity,
        [ActionType.Infinity]: {
          method: HttpRequestMethod.POST,
          url: 'https://api.example.com',
          body: '{}',
          queryParams: [],
          headers: [['Content-Type', 'application/json']],
          datasourceUid: 'test-ds-uid',
          datasourceType: SupportedDataSourceTypes.Infinity,
        },
      };

      render(<ActionEditor {...defaultProps} value={proxyAction} />);

      expect(screen.getByText('Connection')).toBeInTheDocument();
    });

    it('renders with fetch action type showing direct connection', () => {
      const fetchAction: Action = {
        ...defaultAction,
        type: ActionType.Fetch,
        [ActionType.Fetch]: {
          method: HttpRequestMethod.POST,
          url: 'https://api.example.com',
          body: '{}',
          queryParams: [],
          headers: [['Content-Type', 'application/json']],
        },
      };

      render(<ActionEditor {...defaultProps} value={fetchAction} />);

      expect(screen.getByText('Connection')).toBeInTheDocument();
      expect(screen.getByText('Direct from browser')).toBeInTheDocument();
    });

    it('renders with Infinity action type showing datasource connection', () => {
      const proxyAction: Action = {
        ...defaultAction,
        type: ActionType.Infinity,
        [ActionType.Infinity]: {
          method: HttpRequestMethod.POST,
          url: 'https://api.example.com',
          body: '{}',
          queryParams: [],
          headers: [['Content-Type', 'application/json']],
          datasourceUid: 'test-datasource-uid',
          datasourceType: SupportedDataSourceTypes.Infinity,
        },
      };

      render(<ActionEditor {...defaultProps} value={proxyAction} />);

      expect(screen.getByText('Connection')).toBeInTheDocument();
      const connectionSection = screen.getByText('Connection').closest('.css-15ix71y-InlineFieldRow');
      expect(connectionSection).toBeInTheDocument();
    });
  });
});
