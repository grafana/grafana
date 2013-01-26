var dashboards = 
{
  title: "Infinite Monkey Dashboard",
  rows: {
    row1: {
      height: "200px",
      panels: {
        "Monkey Productivity": {
          type    : "histogram",
          span    : 8,
          show    : ['lines','points'],
          query   : "*",
          label   : "Monkey lines of shakespeare",
          color   : "#7BA4AF"
        },
        "Works of Shakespeare": {
          type    : "pieterms",
          legend  : true,
          field   : "play_name",
          span    : 4,
          size    : 10,
          query   : "*"
        }
      }
    },
    row2: {
      height: "250px",
      panels: {
        "Royal Decrees": {
          type    : "stackedquery",
          span    : 4,
          donut   : true,
          queries : ['king','queen','duke'],
        },
        "Person: Thy vs Thou": {
          type    : "piequery",
          span    : 4,
          donut   : true,
          queries : ['thy','thou'],
          colors  : ['#B07737','#85004B','#7BA4AF'],
        },
        "Main Characters": {
          type    : "pieterms",
          donut   : true,
          legend  : true,
          field   : "speaker",
          span    : 4,
          size    : 5,
          query   : "*",
        }
      }
    }
  }
};
