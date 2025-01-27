import { Stack, Text, Button } from '@grafana/ui';

import { BulkActionElement, MultiSelectedEditableDashboardElement } from '../scene/types';

export class MultiSelectedObjectsEditableElement implements MultiSelectedEditableDashboardElement {
  public isMultiSelectedEditableDashboardElement: true = true;
  private objects?: BulkActionElement[];

  constructor(objects: BulkActionElement[]) {
    this.objects = objects;
  }

  public onDelete = () => {
    for (const object of this.objects || []) {
      object.onDelete();
    }
  };

  public getTypeName(): string {
    return 'Objects';
  }

  renderActions(): React.ReactNode {
    return (
      <>
        <Stack direction={'column'}>
          <Text>{`No. of objects selected: ${this.objects?.length}`}</Text>
          <Stack direction={'row'}>
            <Button size="sm" variant="secondary" icon="copy" />
            <Button size="sm" variant="destructive" fill="outline" onClick={this.onDelete} icon="trash-alt" />
          </Stack>
        </Stack>
      </>
    );
  }
}
