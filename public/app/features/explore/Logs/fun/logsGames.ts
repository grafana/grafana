import { useEffect, useRef, useState } from 'react';

import { LogLevel, LogRowModel } from '@grafana/data';
import { createLogRow } from 'app/features/logs/components/mocks/logRow';

const map = `Score: 000000                              Lives: ♥♥♥♥
================================================================================
                                                                                
                                   [=U=]        
                                                                                                                                                            
      <o_o>    <o_o>    <o_o>    <o_o>    <o_o>    <o_o>    <o_o>    <o_o>
      [-_-]    [-_-]    [-_-]    [-_-]    [-_-]    [-_-]    [-_-]    [-_-]
      <^_^>    <^_^>    <^_^>    <^_^>    <^_^>    <^_^>    <^_^>    <^_^>
      <@_@>    <@_@>    <@_@>    <@_@>    <@_@>    <@_@>    <@_@>    <@_@>
                                                                                
            

      


            ###              ###              ###              ###            
           #####            #####            #####            #####           
          #######          #######          #######          #######          
           #####            #####            #####            #####           
            ###              ###              ###              ###            
                                                                                
                                                                                
                                                                      
                                       /A\\
================================================================================`;

const player = '/A\\';
const initialPlayerX = 39;
const playerY = 23;

const userMissileSprite = '╫';
const userMissileRegex = new RegExp(userMissileSprite, 'g');
const enemyMissileSprite = '¦';
const enemyMissileRegex = new RegExp(enemyMissileSprite, 'g');
const missileSpeed = 0.06;
const enemyMissileSpeed = 0.01;
const enemySpeed = 0.001;
const ufoSpeed = 0.0095;

type Missile = {
  x: number;
  y: number;
  get gridY(): number;
  hit: boolean;
};
type Enemy = {
  x: number;
  get gridX(): number;
  sourceX: number;
  direction: 'l' | 'r';
  y: number;
  type: number;
  body: string;
  health: number;
};
const ufo = '[=U=]';
const enemyTypes = ['<@_@>', '<^_^>', '[-_-]', '<o_o>', ufo];
const enemyScores = [10, 20, 30, 40, 100];
const enemyTypeUfo = enemyTypes.indexOf(ufo);
const explosion1 = 'xX*Xx';
const explosion2 = '-X*X-';
const explosion3 = '--*--';
const explosion4 = '  *  ';
const enemySprites = [
  [explosion4, explosion3, explosion2, explosion1, '<@_@>'],
  [explosion4, explosion3, explosion2, explosion1, ' ^_^ ', '<^_^>'],
  [explosion4, explosion3, explosion2, explosion1, ' -_- ', '(-_-)', '[-_-]'],
  [explosion4, explosion3, explosion2, explosion1, ' o_o ', 'co_oↄ', '<o_o>', '<o_o>'],
  [explosion4, explosion3, explosion2, explosion1, ' =u= ', '(=u=)', ufo, ufo, ufo],
];

const shield = '#';

export function useLogsGames() {
  const [gameState, setGameState] = useState<LogRowModel[] | undefined>(undefined);
  const [playerX, setPlayerX] = useState(initialPlayerX);
  const [userMissiles, setUserMisiles] = useState<Missile[]>([]);
  const [enemyMissiles, setEnemyMissiles] = useState<Missile[]>([]);
  const [enemies, setEnemies] = useState<Enemy[]>([]);
  const [gameEnded, setGameEnded] = useState(false);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(4);
  const pausedRef = useRef(false);

  const lastTime = useRef(0);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    function loop(t: number) {
      const dt = Math.min(t - lastTime.current, 50);
      lastTime.current = t;

      const { newGameState, newUserMissiles, newEnemies, newScore, newLives, newEnemyMissiles } = update(
        dt,
        gameState,
        playerX,
        userMissiles,
        enemyMissiles,
        enemies,
        score,
        lives
      );

      setGameState(newGameState);
      setUserMisiles(newUserMissiles);
      setEnemyMissiles(newEnemyMissiles);
      setEnemies(newEnemies);
      setScore(newScore);
      setLives(newLives);

      if (newEnemies.length === 0 || lives === 0) {
        setGameEnded(true);
      }

      frame.current = requestAnimationFrame(loop);
    }

    if (!gameEnded && !pausedRef.current) {
      frame.current = requestAnimationFrame(loop);
    }

    return () => {
      if (frame.current) {
        cancelAnimationFrame(frame.current);
      }
    };
  }, [enemies, enemyMissiles, gameEnded, gameState, lives, playerX, score, userMissiles]);

  useEffect(() => {
    function handlePause() {
      if (document.hidden) {
        pausedRef.current = true;
        console.log('Game paused');
      } else {
        pausedRef.current = false;
        console.log('Game resumed');
      }
    }
    function pause() {
      pausedRef.current = true;
      console.log('Game paused');
    }
    function resume() {
      pausedRef.current = false;
      console.log('Game resumed');
    }
    document.addEventListener('visibilitychange', handlePause);
    document.addEventListener('blur', pause);
    document.addEventListener('focus', resume);

    return () => {
      document.removeEventListener('visibilitychange', handlePause);
      document.removeEventListener('blur', pause);
      document.removeEventListener('focus', resume);
    };
  });

  useEffect(() => {
    function handleKeyPress(e: KeyboardEvent) {
      if (e.code !== 'ArrowLeft' && e.code !== 'ArrowRight' && e.code !== 'Space') {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      if (e.code === 'ArrowLeft') {
        setPlayerX(Math.max(playerX - 1, 0));
      } else if (e.code === 'ArrowRight') {
        setPlayerX(Math.min(playerX + 1, 80));
      } else if (e.code === 'Space' && userMissiles.length < 2) {
        setUserMisiles([...userMissiles, newUserMissile(playerX, playerY - 1)]);
      }
    }
    document.addEventListener('keydown', handleKeyPress);
    return () => {
      document.removeEventListener('keydown', handleKeyPress);
    };
  }, [playerX, userMissiles]);

  return gameState;
}

function update(
  dt: number,
  gameState: LogRowModel[] | undefined,
  playerX: number,
  userMissiles: Missile[],
  enemyMissiles: Missile[],
  enemies: Enemy[],
  score: number,
  lives: number
) {
  if (gameState === undefined) {
    const newEnemies: Enemy[] = [];
    const logs = map.split('\n').map((row, index) => {
      if (index === playerY) {
        row = row.padStart(initialPlayerX, ' ');
      }
      const foundEnemies = createEnemies(row, index);
      if (foundEnemies) {
        newEnemies.push(...foundEnemies);
      }
      return createLogRow({
        uid: index.toString(),
        entry: row.padEnd(80),
        timeEpochMs: 0,
        logLevel: LogLevel.unknown,
      });
    });
    return {
      newGameState: logs,
      newUserMissiles: userMissiles,
      newEnemyMissiles: enemyMissiles,
      newEnemies: newEnemies,
      newScore: score,
      newLives: lives,
    };
  }

  let newUserMissiles = userMissiles
    .map((missile) => {
      missile.y = missile.y - missileSpeed * dt;
      return missile;
    })
    .filter((missile) => missile.y >= 2);

  let newEnemyMissiles = enemyMissiles
    .map((missile) => {
      missile.y = missile.y + enemyMissileSpeed * dt;
      return missile;
    })
    .filter((missile) => {
      if (missile.gridY === playerY && missile.x >= playerX && missile.x <= playerX + 2) {
        missile.hit = true;
        lives--;
        return false;
      }
      return missile.gridY <= playerY;
    });

  const lowestEnemyY = enemies.reduce((max, enemy) => Math.max(max, enemy.y), 0);
  const shieldStart = gameState.findIndex((row) => row.entry.includes('#'));
  const formationCanMoveDown = shieldStart === -1 || lowestEnemyY + 1 < shieldStart;

  const newEnemies = enemies
    .map((enemy) => {
      const speed = enemy.type === enemyTypeUfo ? ufoSpeed : enemySpeed;

      if (enemy.y === lowestEnemyY && Math.random() > 0.92 && enemyMissiles.length <= 1) {
        newEnemyMissiles.push(newEnemyMissile(enemy.gridX, enemy.y));
      }

      if (enemy.health <= 3) {
        enemy.health -= 1;
      } else if (enemy.direction === 'r') {
        enemy.x = enemy.x + speed * dt;
        if (enemy.type === enemyTypeUfo) {
          if (enemy.gridX >= 74) {
            enemy.direction = 'l';
          }
        } else if (enemy.gridX - enemy.sourceX >= 5) {
          enemy.direction = 'l';
          if (formationCanMoveDown) {
            enemy.y += 1;
          }
        }
      } else {
        enemy.x = enemy.x - speed * dt;
        if (enemy.type === enemyTypeUfo) {
          if (enemy.gridX <= 0) {
            enemy.direction = 'r';
          }
        } else if (enemy.gridX - enemy.sourceX <= -5) {
          enemy.direction = 'r';
          if (formationCanMoveDown) {
            enemy.y += 1;
          }
        }
      }
      return enemy;
    })
    .map((enemy) => {
      const missile = userMissiles.find(
        (missile) => missile.gridY === enemy.y && missile.x >= enemy.gridX && missile.x <= enemy.gridX + 4
      );
      if (missile && enemy.health > 0) {
        missile.hit = true;
        enemy.health -= 1;
        score += enemyScores[enemy.type];
      }
      return enemy;
    })
    .filter((enemy) => enemy.health >= 0);

  newUserMissiles = newUserMissiles.filter((missile) => missile.hit === false);

  let hasChanges = false;

  const newGameState = gameState.map((row, index) => {
    let entry = row.entry;
    if (index === 0) {
      entry = renderScoreAndLives(score, lives);
    } else if (index <= 2 || index > playerY) {
      return row;
    } else if (index === playerY) {
      entry = player.padStart(playerX, ' ');
    } else if (row.entry.includes(shield)) {
      entry = handleEnvironmentCollisions(row.entry, newUserMissiles, newEnemyMissiles, index);
      newUserMissiles = newUserMissiles.filter((missile) => missile.hit === false);
      newEnemyMissiles = newEnemyMissiles.filter((missile) => missile.hit === false);
    } else {
      entry = render(row.entry, newEnemies, newUserMissiles, newEnemyMissiles, index);
    }

    if (entry !== row.entry) {
      hasChanges = true;
    } else {
      return row;
    }

    return createLogRow({
      uid: index.toString(),
      entry: entry,
      timeEpochMs: 0,
      logLevel: LogLevel.unknown,
    });
  });

  if (!hasChanges) {
    return { newGameState: gameState, newUserMissiles, newEnemies, newScore: score, newLives: lives, newEnemyMissiles };
  }

  return { newGameState, newUserMissiles, newEnemies, newScore: score, newLives: lives, newEnemyMissiles };
}

function newUserMissile(x: number, y: number): Missile {
  return {
    x: x - 2,
    y,
    get gridY() {
      return Math.ceil(this.y);
    },
    hit: false,
  };
}

function newEnemyMissile(x: number, y: number): Missile {
  return {
    x: x - 2,
    y,
    get gridY() {
      return Math.ceil(this.y);
    },
    hit: false,
  };
}

function createEnemies(row: string, y: number) {
  const enemies: Enemy[] = [];
  for (let i = 0; i < enemyTypes.length; ) {
    const index = row.indexOf(enemyTypes[i]);
    if (index >= 0) {
      const enemy: Enemy = {
        x: index,
        get gridX() {
          return Math.floor(this.x);
        },
        sourceX: index,
        direction: 'r',
        y,
        type: i,
        body: enemyTypes[i],
        health: i + 4,
      };
      enemies.push(enemy);
      row = row.replace(enemyTypes[i], '     ');
    } else {
      i++;
    }
  }
  return enemies.length ? enemies : undefined;
}

function handleEnvironmentCollisions(row: string, userMissiles: Missile[], enemyMissiles: Missile[], y: number) {
  row = row.replace(userMissileRegex, ' ');
  row = row.replace(enemyMissileRegex, ' ');
  const missiles = userMissiles.filter((missile) => missile.gridY === y);
  missiles.forEach((missile) => {
    if (row.charAt(missile.x) === shield) {
      row = row.substring(0, missile.x) + ' ' + row.substring(missile.x + 1);
      missile.hit = true;
    } else {
      row = row.substring(0, missile.x) + userMissileSprite + row.substring(missile.x + 1);
    }
  });
  enemyMissiles = enemyMissiles.filter((missile) => missile.gridY === y);
  enemyMissiles.forEach((missile) => {
    if (row.charAt(missile.x) === shield) {
      row = row.substring(0, missile.x) + ' ' + row.substring(missile.x + 1);
      missile.hit = true;
    } else {
      row = row.substring(0, missile.x) + enemyMissileSprite + row.substring(missile.x + 1);
    }
  });
  return row;
}

function render(row: string, enemies: Enemy[], userMissiles: Missile[], enemyMissiles: Missile[], y: number) {
  row = row.replace(userMissileRegex, ' ');
  row = row.replace(enemyMissileRegex, ' ');
  enemies = enemies.filter((enemy) => enemy.y === y);
  userMissiles = userMissiles.filter((missile) => missile.gridY === y);
  enemyMissiles = enemyMissiles.filter((missile) => missile.gridY === y);

  if (!enemies.length && !userMissiles.length && !enemyMissiles.length) {
    return '';
  }

  let newRow = '';

  for (let i = 0; i < 80; ) {
    const enemy = enemies.find((enemy) => enemy.gridX === i);
    const missileFromUser = userMissiles.find((missile) => missile.x === i);
    const missileFromEnemy = enemyMissiles.find((missile) => missile.x === i);
    if (enemy) {
      newRow += enemySprites[enemy.type][enemy.health];
      i += 5;
    } else if (missileFromUser) {
      newRow += userMissileSprite;
      i++;
    } else if (missileFromEnemy) {
      newRow += enemyMissileSprite;
      i++;
    } else {
      newRow += ' ';
      i++;
    }
  }

  return newRow;
}

function renderScoreAndLives(score: number, lives: number) {
  return `Score: ${score.toString().padStart(6, '0')}                              Lives: ${new Array(lives).fill('♥').join('')}`;
}
