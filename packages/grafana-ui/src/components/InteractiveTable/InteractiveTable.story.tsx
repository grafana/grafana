import { Meta, StoryFn, StoryObj } from '@storybook/react';
import { useCallback, useMemo, useState } from 'react';
import { CellProps } from 'react-table';

import { LinkButton } from '../Button';
import { Field } from '../Forms/Field';
import { Input } from '../Input/Input';

import { FetchDataArgs, InteractiveTable, InteractiveTableHeaderTooltip } from './InteractiveTable';
import mdx from './InteractiveTable.mdx';

const EXCLUDED_PROPS = ['className', 'renderExpandedRow', 'getRowId', 'fetchData'];

interface CarData {
  id: string;
  firstName: string;
  lastName: string;
  car?: string;
  age: number;
}

const pageableData: CarData[] = [
  { id: '48a3926a-e82c-4c26-b959-3a5f473e186e', firstName: 'Brynne', lastName: 'Denisevich', car: 'Cougar', age: 47 },
  {
    id: 'cf281390-adbf-4407-8cf3-a52e012f63e6',
    firstName: 'Aldridge',
    lastName: 'Shirer',
    car: 'Viper RT/10',
    age: 74,
  },
  { id: 'be5736f5-7015-4668-a03d-44b56f2b012c', firstName: 'Sonni', lastName: 'Hinrich', car: 'Ramcharger', age: 75 },
  { id: 'fdbe3559-c68a-4f2f-b579-48ef02642628', firstName: 'Hanson', lastName: 'Giraudeau', car: 'X5', age: 67 },
  { id: '7d0ee01a-7ac5-4e0a-9c73-e864d10c0152', firstName: 'Whitman', lastName: 'Seabridge', car: 'TSX', age: 99 },
  { id: '177c2287-b7cb-4b5f-8976-56ee993bed61', firstName: 'Aleda', lastName: 'Friman', car: 'X5', age: 44 },
  { id: '87c21e60-c2f4-4a01-b2af-a6d22c196e25', firstName: 'Cullen', lastName: 'Kobpac', car: 'Montero', age: 28 },
  { id: 'dd89f32d-2ef4-4c35-8e23-a8b2219e3a69', firstName: 'Fitz', lastName: 'Butterwick', car: 'Fox', age: 70 },
  { id: 'cc1b4de7-8ec5-49bd-93bc-bee9fa1ccf37', firstName: 'Jordon', lastName: 'Harrington', car: 'Elantra', age: 39 },
  { id: '34badca2-895f-4dff-bd34-74c1edd5f309', firstName: 'Ad', lastName: 'Beare', car: 'Freestyle', age: 58 },
  {
    id: '8676e97d-b19f-4a98-bbb4-a48c3673c216',
    firstName: 'Tally',
    lastName: 'Prestie',
    car: 'Montero Sport',
    age: 91,
  },
  { id: '12ea99c6-ccd9-4313-af92-df9141b3d4bd', firstName: 'Wendel', lastName: 'Chasles', car: 'Corvette', age: 89 },
  { id: 'a153ad38-d9b7-4437-a8ac-c1198f0060ef', firstName: 'Lester', lastName: 'Klewer', car: 'Xterra', age: 21 },
  { id: 'ead42cd5-dcd9-4886-879a-fce2eacb4c2b', firstName: 'Ferd', lastName: 'Pasterfield', car: 'Tiburon', age: 1 },
  { id: '97410315-a0a5-4488-8c91-ba7ff640dd9b', firstName: 'Alphonse', lastName: 'Espinola', car: 'Laser', age: 30 },
  { id: 'e4d93eab-ca85-47cc-9867-06aeb29951e3', firstName: 'Dorry', lastName: 'Attew', car: 'Tahoe', age: 90 },
  { id: 'f0047d6f-f517-4f9d-99c2-ce15dcd6a78a', firstName: 'Zed', lastName: 'McMinn', car: '745', age: 96 },
  { id: '5ac3fac4-7caa-4f8e-8fde-115c4a0eca85', firstName: 'Fredericka', lastName: 'Hains', car: 'A6', age: 39 },
  { id: '03ffcc41-4a03-46f5-a161-431d331293dd', firstName: 'Syd', lastName: 'Brixey', car: 'Camry Hybrid', age: 70 },
  { id: '7086f360-f19d-4b0c-9bce-48b2784f200a', firstName: 'Casey', lastName: 'Margerrison', car: 'NV3500', age: 38 },
  {
    id: '8375ab44-0c61-4987-8154-02d1b2fd12a7',
    firstName: 'Sallyann',
    lastName: 'Northleigh',
    car: 'Tiburon',
    age: 51,
  },
  { id: '3af1e7cc-92c9-4356-85eb-bdcecbdffcda', firstName: 'Yance', lastName: 'Nani', car: 'F350', age: 21 },
  { id: '46cf82f7-d9be-4a1d-b7cc-fc15133353dc', firstName: 'Judas', lastName: 'Riach', car: 'RSX', age: 31 },
  { id: '0d10f9cd-78b9-4584-bc01-a35bcae0a14a', firstName: 'Mikkel', lastName: 'Dellenbrok', car: 'VUE', age: 53 },
  { id: '1a78e628-6b8b-4d6a-b391-bbfa650b8024', firstName: 'Son', lastName: 'Vaudin', car: 'Sunbird', age: 47 },
  { id: 'd1349bf6-6dd1-4aed-9788-84e8b642ad63', firstName: 'Emilio', lastName: 'Liddington', car: 'F250', age: 2 },
  { id: '14a3a8e8-15d7-469e-87c6-85181e22b3b8', firstName: 'Devin', lastName: 'Meadley', car: 'XT', age: 61 },
  { id: '47cccba7-9f9b-44f5-985c-c2e226b2c9e4', firstName: 'Harriott', lastName: 'Seres', car: 'LeSabre', age: 11 },
  { id: 'e668a9b1-1dcd-4b5d-9d4e-479dc08695d6', firstName: 'Elvin', lastName: 'Diable', car: '90', age: 69 },
  { id: 'addf8ee9-934c-4e81-83e8-20f50bbff028', firstName: 'Rey', lastName: 'Scotford', car: 'H1', age: 71 },
  { id: 'f22dbd3f-8419-4a1c-b542-23c3842cb59b', firstName: 'King', lastName: 'Catonne', car: 'Suburban 2500', age: 91 },
  { id: 'c85b7547-3654-41f0-94d6-becc832b81fa', firstName: 'Barbabas', lastName: 'Romeril', car: 'Sorento', age: 5 },
  { id: '8d83b0eb-635d-452e-9f85-f19216207ad1', firstName: 'Hadley', lastName: 'Bartoletti', car: 'Seville', age: 37 },
  { id: '9bdb532a-c747-4288-b2e9-e3f2dc7e0a15', firstName: 'Willie', lastName: 'Dunkerley', car: 'Envoy', age: 34 },
  { id: '6b4413dd-1f77-4504-86ee-1ea5b90c6279', firstName: 'Annamarie', lastName: 'Burras', car: 'Elantra', age: 12 },
  { id: 'f17a5f2a-92a9-48a9-a05c-a3c44c66adb7', firstName: 'Rebecca', lastName: 'Thomason', car: 'Elantra', age: 6 },
  { id: '85f7d4d2-3ae6-42ab-88dd-d4e810ebb76c', firstName: 'Tatum', lastName: 'Monte', car: 'Achieva', age: 53 },
  { id: '3d374982-6cd9-4e6e-abf1-7de38eee4b68', firstName: 'Tallie', lastName: 'Goodlet', car: 'Integra', age: 81 },
  { id: 'ccded1ef-f648-4970-ae6e-882ba4d789fb', firstName: 'Catrina', lastName: 'Thunderman', car: 'RX', age: 91 },
  { id: '3198513a-b05f-4d0d-8187-214f82f88531', firstName: 'Aldric', lastName: 'Awton', car: 'Swift', age: 78 },
  { id: '35c3d0ce-52ea-4f30-8c17-b1e6b9878aa3', firstName: 'Garry', lastName: 'Ineson', car: 'Discovery', age: 25 },
  { id: 'c5ae799a-983f-4933-8a4d-cda754acedc0', firstName: 'Alica', lastName: 'Rubinfeld', car: 'FX', age: 20 },
  { id: 'cd9e5476-1ebb-46f0-926e-cee522e8d332', firstName: 'Wenonah', lastName: 'Blakey', car: 'Cooper', age: 96 },
  { id: '17449829-4a8f-433c-8cb0-a869f153ea34', firstName: 'Bevon', lastName: 'Cushe', car: 'GTI', age: 23 },
  { id: 'd20d41a3-d9fe-492d-91df-51a962c515b9', firstName: 'Marybeth', lastName: 'Gauson', car: 'MR2', age: 53 },
  {
    id: 'cd046551-5df7-44b5-88b3-d1654a838214',
    firstName: 'Kimball',
    lastName: 'Bellhanger',
    car: 'Ram 1500',
    age: 56,
  },
  {
    id: 'a8114bdf-911d-410f-b90b-4c8a9c302743',
    firstName: 'Cindelyn',
    lastName: 'Beamont',
    car: 'Monte Carlo',
    age: 99,
  },
  { id: 'e31709ba-bf65-42d1-8c5c-60d461bc3e75', firstName: 'Elfreda', lastName: 'Riddles', car: 'Montero', age: 59 },
  { id: 'cd67179c-0c49-486d-baa9-8e956b362c2e', firstName: 'Chickie', lastName: 'Picheford', car: 'Legend', age: 56 },
  { id: 'b9b0b559-acc1-4bd8-b052-160ecf3e4f68', firstName: 'Ermanno', lastName: 'Sinott', car: 'Thunderbird', age: 26 },
];

const meta: Meta<typeof InteractiveTable<CarData>> = {
  title: 'Experimental/InteractiveTable',
  component: InteractiveTable,
  parameters: {
    docs: {
      page: mdx,
    },
    controls: {
      exclude: EXCLUDED_PROPS,
    },
  },
  args: {
    columns: [
      { id: 'firstName', header: 'First name', sortType: 'string' },
      { id: 'lastName', header: 'Last name', sortType: 'string' },
      { id: 'car', header: 'Car', sortType: 'string' },
      { id: 'age', header: 'Age' },
    ],
    data: pageableData.slice(0, 10),
    getRowId: (r) => r.id,
    pageSize: 0,
    showExpandAll: false,
  },
  argTypes: {},
};

type TableStoryObj = StoryObj<typeof InteractiveTable<CarData>>;

export const Basic: TableStoryObj = {
  args: {
    columns: [
      {
        id: 'firstName',
        header: 'First name',
        sortType: 'alphanumeric',
      },
      {
        id: 'lastName',
        sortType: 'alphanumeric',
      },
      { id: 'car', header: 'With missing values', sortType: 'alphanumeric', disableGrow: true },
    ],
    data: [
      {
        id: 'be5736f5-7015-4668-a03d-44b56f2b012c',
        firstName: 'Sonni',
        lastName: 'Still sortable!',
        car: 'Legend',
        age: 75,
      },
      { id: 'fdbe3559-c68a-4f2f-b579-48ef02642628', firstName: 'Hanson', lastName: 'Giraudeau', car: 'X5', age: 67 },
      { id: '7d0ee01a-7ac5-4e0a-9c73-e864d10c0152', firstName: 'Whitman', lastName: 'Seabridge', age: 99 },
      { id: '177c2287-b7cb-4b5f-8976-56ee993bed61', firstName: 'Aleda', lastName: 'Friman', car: 'X5', age: 44 },
      { id: '87c21e60-c2f4-4a01-b2af-a6d22c196e25', firstName: 'Cullen', lastName: 'Kobpac', car: 'Montero', age: 28 },
      { id: 'dd89f32d-2ef4-4c35-8e23-a8b2219e3a69', firstName: 'Fitz', lastName: 'Butterwick', car: 'Fox', age: 70 },
      {
        id: 'cc1b4de7-8ec5-49bd-93bc-bee9fa1ccf37',
        firstName: 'Jordon',
        lastName: 'Harrington',
        car: 'Elantra',
        age: 39,
      },
    ],
  },
};

const ExpandedCell = ({ car }: CarData) => {
  return <p>{car}</p>;
};

export const WithRowExpansion: TableStoryObj = {
  args: {
    renderExpandedRow: ExpandedCell,
  },
};

interface WithCustomCellData {
  datasource: string;
  repo: string;
}

const RepoCell = ({
  row: {
    original: { repo },
  },
}: CellProps<WithCustomCellData, void>) => {
  return (
    <LinkButton href={repo} size="sm" icon="external-link-alt">
      Open on GithHub
    </LinkButton>
  );
};

export const WithCustomCell: StoryObj<typeof InteractiveTable<WithCustomCellData>> = {
  args: {
    columns: [
      { id: 'datasource', header: 'Data Source' },
      { id: 'repo', header: 'Repo', cell: RepoCell },
    ],
    data: [
      {
        datasource: 'Prometheus',
        repo: 'https://github.com/prometheus/prometheus',
      },
      {
        datasource: 'Loki',
        repo: 'https://github.com/grafana/loki',
      },
      {
        datasource: 'Tempo',
        repo: 'https://github.com/grafana/tempo',
      },
    ],
    getRowId: (r) => r.datasource,
  },
};

export const WithPagination: StoryFn<typeof InteractiveTable> = (args) => {
  const [filter, setFilter] = useState('');

  const data = useMemo(() => {
    if (filter) {
      return pageableData.filter((d) => d.firstName.toLowerCase().includes(filter.toLowerCase()));
    }
    return pageableData;
  }, [filter]);

  return (
    <>
      <Field label={'Filter data'}>
        <Input
          placeholder={'Filter by first name'}
          onChange={(event) => {
            setFilter(event.currentTarget.value);
          }}
        />
      </Field>
      <InteractiveTable {...args} data={data} />
    </>
  );
};

WithPagination.args = {
  pageSize: 15,
};

const headerTooltips: Record<string, InteractiveTableHeaderTooltip> = {
  age: { content: 'The number of years since the person was born' },
  lastName: {
    content: () => {
      return (
        <>
          <h4>Here is an h4</h4>
          <div>Some content</div>
          <div>Some more content</div>
        </>
      );
    },
    iconName: 'plus-square',
  },
};
export const WithHeaderTooltips: TableStoryObj = {
  args: {
    headerTooltips,
  },
};

export const WithControlledSort: StoryFn<typeof InteractiveTable> = (args) => {
  const [data, setData] = useState(pageableData);

  const fetchData = useCallback(({ sortBy }: FetchDataArgs<CarData>) => {
    if (!sortBy?.length) {
      return setData(pageableData);
    }

    setTimeout(() => {
      const newData = [...pageableData];
      newData.sort((a, b) => {
        const sort = sortBy[0];
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const aData = a[sort.id as keyof Omit<CarData, 'age' | 'car'>];
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        const bData = b[sort.id as keyof Omit<CarData, 'age' | 'car'>];
        if (sort.desc) {
          return bData.localeCompare(aData);
        }
        return aData.localeCompare(bData);
      });
      setData(newData);
    }, 300);
  }, []);

  return <InteractiveTable {...args} data={data} pageSize={15} fetchData={fetchData} />;
};

export default meta;
