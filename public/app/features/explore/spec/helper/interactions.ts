import { selectors } from '@grafana/e2e-selectors';
import { fireEvent, screen } from '@testing-library/react';

export async function changeDatasource(name: string) {
  const datasourcePicker = (await screen.findByLabelText(selectors.components.DataSourcePicker.container)).children[0];
  fireEvent.keyDown(datasourcePicker, { keyCode: 40 });
  const option = screen.getByText(name);
  fireEvent.click(option);
}
