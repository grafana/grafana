import { e2e } from '@grafana/e2e';

e2e.scenario({
  describeName: 'Dashboard templating',
  itName: 'Verify variable interpolation works',
  addScenarioDataSource: false,
  addScenarioDashBoard: false,
  skipScenario: false,
  scenario: () => {
    // Open dashboard global variables and interpolation
    e2e.flows.openDashboard({ uid: 'HYaGDGIMk' });

    const items: any = [];
    const expectedItems: string[] = [
      '__dashboard = Templating - Global variables and interpolation',
      '__dashboard.name = Templating - Global variables and interpolation',
      '__dashboard.uid = HYaGDGIMk',
      '__org.name = Main Org.',
      '__org.id = 1',
      '__user.id = 1',
      '__user.login = admin',
      `Server:raw = A'A"A,BB\\B,CCC`,
      `Server:regex = (A'A"A|BB\\\\B|CCC)`,
      `Server:lucene = ("A'A\\"A" OR "BB\\\\B" OR "CCC")`,
      `Server:glob = {A'A"A,BB\\B,CCC}`,
      `Server:pipe = A'A"A|BB\\B|CCC`,
      `Server:distributed = A'A"A,Server=BB\\B,Server=CCC`,
      `Server:csv = A'A"A,BB\\B,CCC`,
      `Server:html = A'A&quot;A, BB\\B, CCC`,
      `Server:json = ["A'A\\"A","BB\\\\B","CCC"]`,
      `Server:percentencode = %7BA%27A%22A%2CBB%5CB%2CCCC%7D`,
      `Server:singlequote = 'A\\'A"A','BB\\B','CCC'`,
      `Server:doublequote = "A'A\\"A","BB\\B","CCC"`,
      `Server:sqlstring = 'A''A"A','BB\\\B','CCC'`,
      `Server:date = null`,
      `Server:text = All`,
    ];

    e2e()
      .get('.markdown-html li')
      .should('have.length', 22)
      .each(element => {
        items.push(element.text());
      })
      .then(() => {
        expectedItems.forEach((expected, index) => {
          expect(items[index]).to.equal(expected);
        });
      });
  },
});
