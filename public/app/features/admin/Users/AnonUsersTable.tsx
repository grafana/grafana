import { useMemo } from 'react';

import { Trans } from '@grafana/i18n';
import {
  Avatar,
  CellProps,
  Column,
  InteractiveTable,
  Stack,
  Badge,
  Tooltip,
  Pagination,
  FetchDataFunc,
} from '@grafana/ui';
import { EmptyArea } from 'app/features/alerting/unified/components/EmptyArea';
import { UserAnonymousDeviceDTO } from 'app/types/user';

type Cell<T extends keyof UserAnonymousDeviceDTO = keyof UserAnonymousDeviceDTO> = CellProps<
  UserAnonymousDeviceDTO,
  UserAnonymousDeviceDTO[T]
>;

// A helper function to parse the user agent string and extract parts
const parseUserAgent = (userAgent: string) => {
  // If the user agent string doesn't contain a space, it's probably just the browser name
  // or some other entity that are accessing grafana
  if (!userAgent.includes(' ')) {
    return {
      browser: userAgent,
      computer: '',
    };
  }
  const parts = userAgent.split(' ');
  return {
    browser: parts[0],
    computer: parts[1],
  };
};

// A helper function to truncate each part of the user agent
const truncatePart = (part: string, maxLength: number) => {
  return part.length > maxLength ? part.substring(0, maxLength) + '...' : part;
};

interface UserAgentCellProps {
  value: string;
}

const UserAgentCell = ({ value }: UserAgentCellProps) => {
  const parts = parseUserAgent(value);
  return (
    <Tooltip theme="info-alt" content={value} placement="top-end" interactive={true}>
      <span>
        {truncatePart(parts.browser, 10)}
        {truncatePart(parts.computer, 10)}
      </span>
    </Tooltip>
  );
};

interface AnonUsersTableProps {
  devices: UserAnonymousDeviceDTO[];
  // for pagination
  showPaging?: boolean;
  totalPages: number;
  onChangePage: (page: number) => void;
  currentPage: number;
  fetchData?: FetchDataFunc<UserAnonymousDeviceDTO>;
}

export const AnonUsersDevicesTable = ({
  devices,
  showPaging,
  totalPages,
  onChangePage,
  currentPage,
  fetchData,
}: AnonUsersTableProps) => {
  const columns: Array<Column<UserAnonymousDeviceDTO>> = useMemo(
    () => [
      {
        id: 'avatarUrl',
        header: '',
        cell: ({ cell: { value } }: Cell<'avatarUrl'>) => value && <Avatar src={value} alt={'User avatar'} />,
      },
      {
        id: 'login',
        header: 'Login',
        cell: ({ cell: { value } }: Cell<'login'>) => 'Anonymous',
      },
      {
        id: 'userAgent',
        header: 'User Agent',
        cell: ({ cell: { value } }: Cell<'userAgent'>) => <UserAgentCell value={value} />,
        sortType: 'string',
      },
      {
        id: 'updatedAt',
        header: 'Last active',
        cell: ({ cell: { value } }: Cell<'updatedAt'>) => value,
        sortType: (a, b) => new Date(a.original.updatedAt).getTime() - new Date(b.original.updatedAt).getTime(),
      },
      {
        id: 'clientIp',
        header: 'Origin IP (address)',
        cell: ({ cell: { value } }: Cell<'clientIp'>) => value && <Badge text={value} color="orange" />,
      },
    ],
    []
  );
  return (
    <Stack direction={'column'} gap={2}>
      <InteractiveTable columns={columns} data={devices} getRowId={(user) => user.deviceId} fetchData={fetchData} />
      {showPaging && (
        <Stack justifyContent={'flex-end'}>
          <Pagination numberOfPages={totalPages} currentPage={currentPage} onNavigate={onChangePage} />
        </Stack>
      )}
      {devices.length === 0 && (
        <EmptyArea>
          <span>
            <Trans i18nKey="admin.anon-users.not-found">No anonymous users found.</Trans>
          </span>
        </EmptyArea>
      )}
    </Stack>
  );
};
