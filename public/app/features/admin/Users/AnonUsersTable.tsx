import React, { useMemo } from 'react';

import { Avatar, CellProps, Column, InteractiveTable, Stack, Badge, Tooltip } from '@grafana/ui';
import { EmptyArea } from 'app/features/alerting/unified/components/EmptyArea';
import { UserAnonymousDeviceDTO } from 'app/types';

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
}

export const AnonUsersDevicesTable = ({ devices }: AnonUsersTableProps) => {
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
        id: 'lastSeenAt',
        header: 'Last active',
        cell: ({ cell: { value } }: Cell<'lastSeenAt'>) => value,
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
      <InteractiveTable columns={columns} data={devices} getRowId={(user) => user.deviceId} />
      {devices.length === 0 && (
        <EmptyArea>
          <span>No anonymous users found.</span>
        </EmptyArea>
      )}
    </Stack>
  );
};
