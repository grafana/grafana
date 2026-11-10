import { getQuestionSourceRefs } from './questionSources';
import { sectionRef } from './sections';

describe('getQuestionSourceRefs', () => {
  const rowRef = sectionRef(['Errors']);

  it('answers a question from the panels the author picked', () => {
    const question = { text: 'Why did errors rise?', sources: [{ panelId: 3 }, { panelId: 5 }] };

    expect(getQuestionSourceRefs(question, rowRef)).toEqual(['panel-3', 'panel-5']);
  });

  it('answers a question without picked panels from the default', () => {
    expect(getQuestionSourceRefs({ text: 'Why did errors rise?' }, rowRef)).toEqual([rowRef]);
    expect(getQuestionSourceRefs({ text: 'Why did errors rise?', sources: [] }, rowRef)).toEqual([rowRef]);
  });
});
