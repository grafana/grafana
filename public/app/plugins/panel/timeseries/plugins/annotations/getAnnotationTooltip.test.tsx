import { getAnnotationTooltip } from './getAnnotationTooltip';
import { type AnnotationVals } from './types';

// AnnotationVals types ids as numbers, but annotations served by the k8s annotations API
// have string ids (metadata.name), see issue #120097
function makeAnnoVals(id: number | string | null, dashboardUID: string | null = 'dash-1'): AnnotationVals {
  return {
    time: [1759388895560],
    text: ['annotation text'],
    id: [id as number],
    dashboardUID: [dashboardUID],
  };
}

describe('getAnnotationTooltip', () => {
  const canEditAnnotations = jest.fn(() => true);
  const canDeleteAnnotations = jest.fn(() => true);
  const onAnnotationDelete = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function getTooltip(annoVals: AnnotationVals) {
    return getAnnotationTooltip(annoVals, 0, 'utc', canEditAnnotations, canDeleteAnnotations, onAnnotationDelete);
  }

  it.each([
    ['a numeric id from the legacy API', 4683],
    ['a non-numeric string id from the k8s annotations API', 'aef3b1c2-d5e6'],
    ['a numeric string id from the sql-backed k8s annotations API', '23'],
  ])('allows editing and deleting with %s', (_desc, id) => {
    const { canEdit, canDelete } = getTooltip(makeAnnoVals(id));
    expect(canEdit).toBe(true);
    expect(canDelete).toBe(true);
  });

  it.each([
    ['an id of 0 (loki-sourced alert annotation)', 0],
    ['a null id', null],
  ])('disallows editing and deleting with %s', (_desc, id) => {
    const { canEdit, canDelete } = getTooltip(makeAnnoVals(id));
    expect(canEdit).toBe(false);
    expect(canDelete).toBe(false);
  });

  it('disallows editing and deleting without a dashboardUID', () => {
    const { canEdit, canDelete } = getTooltip(makeAnnoVals(4683, null));
    expect(canEdit).toBe(false);
    expect(canDelete).toBe(false);
  });

  it('respects the permission callbacks', () => {
    canEditAnnotations.mockReturnValue(false);
    canDeleteAnnotations.mockReturnValue(false);
    const { canEdit, canDelete } = getTooltip(makeAnnoVals('aef3b1c2-d5e6'));
    expect(canEdit).toBe(false);
    expect(canDelete).toBe(false);
    expect(canEditAnnotations).toHaveBeenCalledWith('dash-1');
    expect(canDeleteAnnotations).toHaveBeenCalledWith('dash-1');
  });

  it('passes the string id through to onAnnotationDelete', () => {
    const { onDelete } = getTooltip(makeAnnoVals('aef3b1c2-d5e6'));
    onDelete!();
    expect(onAnnotationDelete).toHaveBeenCalledWith('aef3b1c2-d5e6');
  });
});
